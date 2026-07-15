/**
 * app/sitemap.ts
 * ---------------
 * Dynamic sitemap generated from live Supabase data.
 *
 * Includes:
 * 1. Static marketing pages (home, features, how-it-works, directory,
 *    login, signup)
 * 2. Individual tradie listing pages (/directory/[slug])
 * 3. Trade×suburb programmatic pages (/electricians-seaford-vic etc.)
 *    -- only included when at least MIN_LISTINGS_FOR_INDEX listings exist
 *    to avoid indexing thin pages that could hurt overall domain quality.
 *
 * ASSUMPTIONS:
 * - directory_listing has no dedicated `slug` column yet. We derive a
 *   deterministic slug from business_name + suburb + id-suffix to guarantee
 *   uniqueness. Once a `slug` column is added to the table, replace
 *   `buildSlug(row)` with `row.slug`.
 * - Trade×suburb pages don't exist as Next.js routes yet (built in Prompt 2).
 *   Their URLs are included now so Google starts crawling before the pages
 *   are live -- this is intentional pre-submission, not an error.
 * - `lastModified` for directory listings uses `updated_at` if available,
 *   falls back to `created_at`.
 *
 * Revalidation: set to 1 day (86400s). Google re-fetches sitemaps at its
 * own pace (typically weekly), but keeping this fresh means new listings
 * appear quickly.
 */

import { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { tradeToSlug, suburbToSlug, buildDirectorySlug } from "@/lib/seo/meta";
import { LEADS_ENABLED } from "@/lib/featureFlags";

// The site's canonical host is www -- the apex domain 301s to it. Sitemap
// URLs must be the final canonical form; URLs that redirect get flagged in
// audits and waste crawl budget.
const BASE_URL = "https://www.swiftscope.com.au";

// NOTE: adjust as listings grow -- don't index trade×suburb pages that are
// too thin, as thin pages dilute overall domain quality in Google's eyes.
const MIN_LISTINGS_FOR_INDEX = 3;

// buildSlug moved to lib/seo/meta.ts as buildDirectorySlug - was
// duplicated identically here and in generateTradeSuburbContent.ts.
const buildSlug = buildDirectorySlug;

export const revalidate = 86400; // 24 hours

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── 1. Static pages ──────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                       changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE_URL}/directory`,        changeFrequency: "daily",   priority: 0.9 },
    ...(LEADS_ENABLED ? [{ url: `${BASE_URL}/get-quotes`, changeFrequency: "monthly" as const, priority: 0.8 }] : []),
    { url: `${BASE_URL}/features`,         changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/how-it-works`,     changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/signup`,           changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/login`,            changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/terms`,            changeFrequency: "yearly",  priority: 0.2 },
    { url: `${BASE_URL}/privacy`,          changeFrequency: "yearly",  priority: 0.2 },
  ];

  // Supabase env vars won't be present at build time in CI -- return
  // static-only sitemap then; the revalidation will hydrate it at runtime.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return staticPages;
  }

  const admin = createAdminClient();

  // ── 2. Individual listing pages ───────────────────────────────────────
  const { data: listings, error: listingsErr } = await admin
    .from("directory_listing")
    .select("id, business_name, suburb, updated_at, created_at")
    .not("business_name", "is", null)
    .not("suburb", "is", null);

  if (listingsErr) console.error("[sitemap] listings fetch failed:", listingsErr.message);

  const listingPages: MetadataRoute.Sitemap = (listings ?? []).map((row) => ({
    url: `${BASE_URL}/directory/${buildSlug(row)}`,
    lastModified: new Date(row.updated_at ?? row.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // ── 3. Trade×suburb programmatic pages ───────────────────────────────
  // Fetch distinct trade+suburb combos above the minimum listing threshold.
  const { data: tradeSuburbRows, error: tsErr } = await admin.rpc(
    "get_trade_suburb_counts"
  ).select("trade, suburb, listing_count");

  // ASSUMPTION: the RPC above may not exist yet. Fall back to a direct
  // query if the RPC fails.
  let tradeSuburbs: Array<{ trade: string; suburb: string; count: number }> = [];

  if (tsErr || !tradeSuburbRows) {
    // Direct query fallback -- slightly slower but always available
    const { data: directRows } = await admin
      .from("directory_listing")
      .select("trades, suburb")
      .not("suburb", "is", null);

    const counts = new Map<string, number>();
    for (const row of directRows ?? []) {
      for (const trade of row.trades ?? []) {
        const key = `${trade}|${row.suburb}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    for (const [key, count] of counts.entries()) {
      const [trade, suburb] = key.split("|");
      tradeSuburbs.push({ trade, suburb, count });
    }
  } else {
    tradeSuburbs = (tradeSuburbRows as Array<{ trade: string; suburb: string; listing_count: number }>)
      .map((r) => ({ trade: r.trade, suburb: r.suburb, count: r.listing_count }));
  }

  const programmaticPages: MetadataRoute.Sitemap = tradeSuburbs
    .filter((r) => r.count >= MIN_LISTINGS_FOR_INDEX)
    .map((r) => ({
      url: `${BASE_URL}/${tradeToSlug(r.trade)}-${suburbToSlug(r.suburb)}-vic`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  // ── 4. Suburb-only "Tradies in X" pages ──────────────────────────────
  // One page per suburb (all trades combined) alongside the trade+suburb
  // pages above - covers broad "tradies in {suburb}" searches that don't
  // specify a trade, which none of the trade-specific pages target.
  const suburbTotals = new Map<string, number>();
  for (const r of tradeSuburbs) {
    const key = suburbToSlug(r.suburb);
    suburbTotals.set(key, (suburbTotals.get(key) ?? 0) + r.count);
  }
  const suburbPages: MetadataRoute.Sitemap = Array.from(suburbTotals.entries())
    .filter(([, count]) => count >= MIN_LISTINGS_FOR_INDEX)
    .map(([suburbSlug]) => ({
      url: `${BASE_URL}/tradies-in-${suburbSlug}-vic`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  return [...staticPages, ...listingPages, ...programmaticPages, ...suburbPages];
}
