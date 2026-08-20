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
 *    - only included when at least MIN_LISTINGS_FOR_INDEX listings exist
 *    to avoid indexing thin pages that could hurt overall domain quality.
 *
 * ASSUMPTIONS:
 * - directory_listing has no dedicated `slug` column yet. We derive a
 *   deterministic slug from business_name + suburb + id-suffix to guarantee
 *   uniqueness. Once a `slug` column is added to the table, replace
 *   `buildSlug(row)` with `row.slug`.
 * - Trade×suburb pages don't exist as Next.js routes yet (built in Prompt 2).
 *   Their URLs are included now so Google starts crawling before the pages
 *   are live - this is intentional pre-submission, not an error.
 * - `lastModified` for directory listings uses `updated_at` if available,
 *   falls back to `created_at`.
 *
 * Revalidation: set to 1 day (86400s). Google re-fetches sitemaps at its
 * own pace (typically weekly), but keeping this fresh means new listings
 * appear quickly.
 */

import { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { tradeToSlug, buildDirectorySlug } from "@/lib/seo/meta";
import { LEADS_ENABLED } from "@/lib/featureFlags";
import { TRADE_HUBS } from "@/lib/marketing/trade-hubs";

// The site's canonical host is the bare apex - www 308s to it, enforced
// in both middleware.ts (NON_CANONICAL_HOSTS) and the Vercel domain
// config. Sitemap URLs must be the final canonical form; URLs that
// redirect get flagged in audits and waste crawl budget.
//
// This comment previously claimed the opposite (www canonical, apex
// redirecting). It was wrong, and the two layers were briefly configured
// in opposite directions, which produced an ERR_TOO_MANY_REDIRECTS loop
// that took every directory page offline. Keep this in sync with
// middleware.ts if the canonical host ever changes.
const BASE_URL = "https://swiftscope.com.au";

// NOTE: adjust as listings grow - don't index trade×suburb pages that are
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
    { url: `${BASE_URL}/blog`,             changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/features`,         changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/for`,              changeFrequency: "monthly", priority: 0.8 },
    ...TRADE_HUBS.map((hub) => ({
      url: `${BASE_URL}/for/${hub.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
    { url: `${BASE_URL}/tools`,            changeFrequency: "monthly", priority: 0.7 },
    ...[
      "charge-out-rate",
      "margin-markup",
      "quote-pdf",
      "vehicle-cost",
      "ballpark-cost",
      "diy-materials",
    ].map((slug) => ({
      url: `${BASE_URL}/tools/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${BASE_URL}/how-it-works`,     changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/signup`,           changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/login`,            changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/terms`,            changeFrequency: "yearly",  priority: 0.2 },
    { url: `${BASE_URL}/privacy`,          changeFrequency: "yearly",  priority: 0.2 },
  ];

  // Supabase env vars won't be present at build time in CI - return
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
  // Source directly from trade_suburb_pages - same table the actual
  // trade+suburb and suburb-hub pages read from, already has correct
  // per-listing state (derived from postcode, not a hardcoded "vic").
  // Previously used a separate RPC/direct-query path that never had
  // state at all, so every sitemap entry claimed "-vic" regardless of
  // the listing's real state.
  const PAGE_SIZE = 1000;
  const tradeSuburbs: Array<{ trade: string; suburb: string; suburbSlug: string; state: string; count: number }> = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page } = await admin
      .from("trade_suburb_pages")
      .select("trade, suburb, suburb_slug, state, listing_count")
      .eq("is_indexed", true)
      .range(from, from + PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    for (const r of page) {
      tradeSuburbs.push({ trade: r.trade, suburb: r.suburb, suburbSlug: r.suburb_slug, state: r.state, count: r.listing_count ?? 0 });
    }
    if (page.length < PAGE_SIZE) break;
  }

  const programmaticPages: MetadataRoute.Sitemap = tradeSuburbs
    .filter((r) => r.count >= MIN_LISTINGS_FOR_INDEX)
    .map((r) => ({
      url: `${BASE_URL}/${tradeToSlug(r.trade)}-${r.suburbSlug}-${r.state}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  // ── 4. Suburb-only "Tradies in X" pages ──────────────────────────────
  // One page per suburb (all trades combined) alongside the trade+suburb
  // pages above - covers broad "tradies in {suburb}" searches that don't
  // specify a trade, which none of the trade-specific pages target.
  const suburbTotals = new Map<string, { count: number; state: string }>();
  for (const r of tradeSuburbs) {
    const key = r.suburbSlug;
    const existing = suburbTotals.get(key);
    suburbTotals.set(key, { count: (existing?.count ?? 0) + r.count, state: r.state });
  }
  const suburbPages: MetadataRoute.Sitemap = Array.from(suburbTotals.entries())
    .filter(([, v]) => v.count >= MIN_LISTINGS_FOR_INDEX)
    .map(([suburbSlug, v]) => ({
      url: `${BASE_URL}/tradies-in/${suburbSlug}-${v.state}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  // ── 5. Blog posts ────────────────────────────────────────────────────
  // /blog and /blog/[slug] have existed as routes since launch but were
  // never emitted here, so Google had no discovery path to them at all -
  // absent from the sitemap and reachable only via the marketing nav.
  // That made every published post effectively invisible in search, which
  // is the whole reason the blog exists.
  //
  // Published only: `published = false` rows are drafts and must never be
  // exposed here, since a sitemap entry is a crawl invitation and
  // /blog/[slug] 404s on unpublished slugs anyway.
  const { data: posts, error: postsErr } = await admin
    .from("blog_posts")
    .select("slug, published_at, updated_at, created_at")
    .eq("published", true)
    .not("slug", "is", null);

  if (postsErr) console.error("[sitemap] blog posts fetch failed:", postsErr.message);

  const blogPages: MetadataRoute.Sitemap = (posts ?? []).map((row) => ({
    url: `${BASE_URL}/blog/${row.slug}`,
    lastModified: new Date(row.updated_at ?? row.published_at ?? row.created_at),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...listingPages, ...programmaticPages, ...suburbPages, ...blogPages];
}
