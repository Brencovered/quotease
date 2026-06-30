/**
 * GET /api/cron/refresh-seo
 * ---------------------------
 * Weekly automation (see vercel.json for schedule):
 * 1. Re-scans directory_listing, recomputes trade x suburb stats, and
 *    upserts trade_suburb_pages -- this is what generateStaticParams and
 *    the sitemap eventually read from (today they still query
 *    directory_listing directly as a safe fallback; see NOTE below).
 * 2. Triggers Next.js revalidation for the sitemap and every trade x suburb
 *    page that changed indexability (crossed the 3-listing threshold
 *    either direction) since the last run.
 * 3. "Pings" Google with the sitemap location.
 *
 * AUTH: protected by CRON_SECRET. Vercel Cron calls this with
 * `Authorization: Bearer ${CRON_SECRET}` automatically once that env var
 * is set in the Vercel project AND referenced in vercel.json's cron config
 * (see vercel.json comments) -- without setting CRON_SECRET, this route
 * will reject all requests including Vercel's own, so don't forget that
 * env var or the cron will silently fail every run.
 *
 * ASSUMPTIONS / HONEST LIMITATIONS:
 * - Sitemap submission tries the real Search Console API first
 *   (lib/seo/searchConsole.ts) and only falls back to the legacy
 *   google.com/ping endpoint if that's not configured yet. Google
 *   deprecated the ping endpoint in mid-2023 -- it still returns 200 but
 *   does nothing. Until GOOGLE_SERVICE_ACCOUNT_KEY is set up, this run
 *   step is cosmetic.
 * - revalidatePath on every changed page works, but at scale (hundreds of
 *   suburbs) this could hit Vercel's revalidation rate limits in one run.
 *   Fine for current data volume; revisit (batch/stagger) before this
 *   table gets into the thousands of rows.
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tradeToSlug, suburbToSlug } from "@/lib/seo/meta";
import { submitSitemap } from "@/lib/seo/searchConsole";

const MIN_LISTINGS_FOR_INDEX = 3;
const BASE_URL = "https://swiftscope.com.au";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[refresh-seo] CRON_SECRET is not set -- rejecting all requests, including Vercel's own cron trigger.");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Best-effort only -- see ASSUMPTIONS above. Does not throw on failure. */
async function pingGoogleLegacy(): Promise<boolean> {
  try {
    const res = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(`${BASE_URL}/sitemap.xml`)}`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let pagesScanned = 0;
  let pagesUpdated = 0;
  let pagesNewlyIndexed = 0;
  let pagesNewlyDeindexed = 0;
  let errorMsg: string | null = null;

  try {
    // ── 1. Recompute trade x suburb aggregates ───────────────────────────
    const { data: rows, error: rowsErr } = await admin
      .from("directory_listing")
      .select("trades, suburb, google_rating, google_reviews_count")
      .not("suburb", "is", null);

    if (rowsErr) throw new Error(`directory_listing fetch failed: ${rowsErr.message}`);

    type Agg = { suburb: string; count: number; ratingSum: number; ratingCount: number; reviews: number };
    const aggregates = new Map<string, Agg>(); // key: `${trade}|${suburbSlug}`

    for (const row of rows ?? []) {
      if (!row.suburb) continue;
      const suburbSlug = suburbToSlug(row.suburb);
      for (const trade of row.trades ?? []) {
        const key = `${trade}|${suburbSlug}`;
        const agg = aggregates.get(key) ?? { suburb: row.suburb, count: 0, ratingSum: 0, ratingCount: 0, reviews: 0 };
        agg.count += 1;
        if (row.google_rating != null && (row.google_reviews_count ?? 0) >= 3) {
          agg.ratingSum += Number(row.google_rating);
          agg.ratingCount += 1;
        }
        agg.reviews += row.google_reviews_count ?? 0;
        aggregates.set(key, agg);
      }
    }
    pagesScanned = aggregates.size;

    // Existing state, to detect indexability transitions for targeted revalidation.
    const { data: existingPages } = await admin
      .from("trade_suburb_pages")
      .select("trade, suburb_slug, state, is_indexed");
    const existingIndexed = new Map<string, boolean>(
      (existingPages ?? []).map((p) => [`${p.trade}|${p.suburb_slug}|${p.state}`, p.is_indexed])
    );

    const pathsToRevalidate = new Set<string>();

    for (const [key, agg] of aggregates.entries()) {
      const [trade, suburbSlug] = key.split("|");
      const state = "vic"; // NOTE: hardcoded until directory_listing has a real state column
      const isIndexed = agg.count >= MIN_LISTINGS_FOR_INDEX;
      const avgRating = agg.ratingCount > 0 ? agg.ratingSum / agg.ratingCount : null;

      const { error: upsertErr } = await admin
        .from("trade_suburb_pages")
        .upsert(
          {
            trade,
            suburb: agg.suburb,
            suburb_slug: suburbSlug,
            state,
            listing_count: agg.count,
            avg_rating: avgRating,
            total_reviews: agg.reviews,
            is_indexed: isIndexed,
            last_refreshed_at: new Date().toISOString(),
          },
          { onConflict: "trade,suburb_slug,state" }
        );

      if (upsertErr) {
        console.error(`[refresh-seo] upsert failed for ${key}:`, upsertErr.message);
        continue;
      }
      pagesUpdated++;

      const wasIndexed = existingIndexed.get(`${trade}|${suburbSlug}|${state}`);
      if (wasIndexed !== isIndexed) {
        if (isIndexed) pagesNewlyIndexed++; else pagesNewlyDeindexed++;
        pathsToRevalidate.add(`/${tradeToSlug(trade)}-${suburbSlug}-${state}`);
      }
    }

    // ── 2. Revalidate changed pages + sitemap ────────────────────────────
    for (const path of pathsToRevalidate) {
      try { revalidatePath(path); } catch (err) { console.error(`[refresh-seo] revalidatePath failed for ${path}:`, err); }
    }
    revalidatePath("/sitemap.xml");

    // ── 3. Sitemap submission ────────────────────────────────────────────
    // Tries the real (modern) Search Console API path first -- only works
    // once GOOGLE_SERVICE_ACCOUNT_KEY is configured (see
    // lib/seo/searchConsole.ts). Falls back to the legacy ping endpoint,
    // which Google has confirmed does nothing anymore but is harmless to
    // call. Either way, this never fails the whole cron run -- a sitemap
    // submission hiccup shouldn't mask a successful data refresh.
    let sitemapPinged = false;
    try {
      await submitSitemap();
      sitemapPinged = true;
    } catch (err) {
      console.warn("[refresh-seo] Search Console submission unavailable, falling back to legacy ping:", err instanceof Error ? err.message : err);
      sitemapPinged = await pingGoogleLegacy();
    }

    await admin.from("seo_refresh_log").insert({
      pages_scanned: pagesScanned,
      pages_updated: pagesUpdated,
      pages_newly_indexed: pagesNewlyIndexed,
      pages_newly_deindexed: pagesNewlyDeindexed,
      sitemap_pinged: sitemapPinged,
      duration_ms: Date.now() - startedAt,
      status: "success",
    });

    return NextResponse.json({
      ok: true,
      pagesScanned,
      pagesUpdated,
      pagesNewlyIndexed,
      pagesNewlyDeindexed,
      revalidatedPaths: Array.from(pathsToRevalidate),
      sitemapPinged,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[refresh-seo] failed:", errorMsg);

    await admin.from("seo_refresh_log").insert({
      pages_scanned: pagesScanned,
      pages_updated: pagesUpdated,
      pages_newly_indexed: pagesNewlyIndexed,
      pages_newly_deindexed: pagesNewlyDeindexed,
      sitemap_pinged: false,
      duration_ms: Date.now() - startedAt,
      status: pagesUpdated > 0 ? "partial" : "failed",
      error: errorMsg,
    });

    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}
