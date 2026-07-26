import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tradeToSlug, suburbToSlug, postcodeToState } from "@/lib/seo/meta";
import { submitSitemap } from "@/lib/seo/searchConsole";

const MIN_LISTINGS_FOR_INDEX = 3;
const BASE_URL = "https://swiftscope.com.au";

/** Best-effort only. Does not throw on failure. */
async function pingGoogleLegacy(): Promise<boolean> {
  try {
    const res = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(`${BASE_URL}/sitemap.xml`)}`);
    return res.ok;
  } catch {
    return false;
  }
}

export interface SeoRefreshResult {
  ok: boolean;
  pagesScanned: number;
  pagesUpdated: number;
  pagesNewlyIndexed: number;
  pagesNewlyDeindexed: number;
  revalidatedPaths: string[];
  sitemapPinged: boolean;
  durationMs: number;
  error?: string;
}

/**
 * Recomputes trade x suburb aggregates from directory_listing, upserts
 * trade_suburb_pages (which /areas, /tradies-in-[suburbState], and
 * app/[tradeSuburb]'s generateStaticParams all read from), revalidates any
 * page whose indexability crossed the 3-listing threshold, and pings
 * Google with the sitemap. Shared by the weekly cron
 * (app/api/cron/refresh-seo) and the admin manual-trigger route
 * (app/api/admin/seo/refresh) -- same logic either way, just a different
 * caller and auth check.
 */
export async function runSeoRefresh(): Promise<SeoRefreshResult> {
  const startedAt = Date.now();
  const admin = createAdminClient();
  let pagesScanned = 0;
  let pagesUpdated = 0;
  let pagesNewlyIndexed = 0;
  let pagesNewlyDeindexed = 0;

  try {
    const { data: rows, error: rowsErr } = await admin
      .from("directory_listing")
      .select("trades, suburb, postcode, google_rating, google_reviews_count")
      .not("suburb", "is", null);

    if (rowsErr) throw new Error(`directory_listing fetch failed: ${rowsErr.message}`);

    type Agg = { suburb: string; state: string; count: number; ratingSum: number; ratingCount: number; reviews: number };
    // Key includes state -- suburb name alone can collide across states
    // (e.g. Seaford VIC and Seaford SA, a real duplicate confirmed in
    // this directory), which would otherwise merge two entirely
    // different physical locations into one aggregate.
    const aggregates = new Map<string, Agg>(); // key: `${trade}|${suburbSlug}|${state}`

    for (const row of rows ?? []) {
      if (!row.suburb) continue;
      const suburbSlug = suburbToSlug(row.suburb);
      const state = postcodeToState(row.postcode);
      for (const trade of row.trades ?? []) {
        const key = `${trade}|${suburbSlug}|${state}`;
        const agg = aggregates.get(key) ?? { suburb: row.suburb, state, count: 0, ratingSum: 0, ratingCount: 0, reviews: 0 };
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

    const { data: existingPages } = await admin
      .from("trade_suburb_pages")
      .select("trade, suburb_slug, state, is_indexed");
    const existingIndexed = new Map<string, boolean>(
      (existingPages ?? []).map((p) => [`${p.trade}|${p.suburb_slug}|${p.state}`, p.is_indexed])
    );

    const pathsToRevalidate = new Set<string>();

    for (const [key, agg] of aggregates.entries()) {
      const [trade, suburbSlug, state] = key.split("|");
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

    for (const path of pathsToRevalidate) {
      try { revalidatePath(path); } catch (err) { console.error(`[refresh-seo] revalidatePath failed for ${path}:`, err); }
    }
    revalidatePath("/sitemap.xml");
    revalidatePath("/areas");

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

    return {
      ok: true,
      pagesScanned,
      pagesUpdated,
      pagesNewlyIndexed,
      pagesNewlyDeindexed,
      revalidatedPaths: Array.from(pathsToRevalidate),
      sitemapPinged,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
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

    return {
      ok: false,
      pagesScanned,
      pagesUpdated,
      pagesNewlyIndexed,
      pagesNewlyDeindexed,
      revalidatedPaths: [],
      sitemapPinged: false,
      durationMs: Date.now() - startedAt,
      error: errorMsg,
    };
  }
}
