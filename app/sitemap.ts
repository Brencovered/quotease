/**
 * app/sitemap.ts
 * ---------------
 * Dynamic sitemap generated from live Supabase data.
 *
 * Includes:
 * 1. Static marketing pages (home, features, how-it-works, directory)
 * 2. Individual tradie listing pages (/directory/[slug])
 * 3. Trade×suburb programmatic pages (/electricians-seaford-vic etc.)
 *    - only included when at least MIN_LISTINGS_FOR_INDEX listings exist
 *    to avoid indexing thin pages that could hurt overall domain quality.
 *
 * ASSUMPTIONS:
 * - directory_listing has no dedicated `slug` column. The canonical path
 *   is directoryProfilePath (business + suburb + id suffix). UUID URLs
 *   are not listed; they 308 to that path.
 * - Trade×suburb pages (app/[tradeSuburb]) and suburb hubs
 *   (app/tradies-in/[suburbState]) are live routes; their URLs are emitted
 *   from trade_suburb_pages where is_indexed is true and the listing
 *   count meets MIN_LISTINGS_FOR_INDEX. Thin and noindex rows stay out.
 * - `lastModified` for directory listings uses `updated_at` if available,
 *   falls back to `created_at`.
 *
 * Revalidation: set to 1 day (86400s). Google re-fetches sitemaps at its
 * own pace (typically weekly), but keeping this fresh means new listings
 * appear quickly.
 *
 * Scale note: this returns a single sitemap document. Google's limit is
 * 50,000 URLs / 50MB per file. Listing and trade×suburb reads page
 * through PostgREST (hard cap 1,000 rows per response) until a short
 * page, so the document is the full eligible set rather than the first
 * page. If the combined URL count approaches 50,000, split via Next's
 * generateSitemaps() into a sitemap index.
 */

import { MetadataRoute } from "next";
import { TRADE_PAGES } from "@/lib/marketing/tradePages";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/seo/fetchAllPages";
import { LEADS_ENABLED } from "@/lib/featureFlags";
import { TRADE_HUBS } from "@/lib/marketing/trade-hubs";
import {
  CANONICAL_ORIGIN,
  sitemapShouldQueryDatabase,
  blogSitemapEntries,
  listingSitemapEntries,
  suburbHubSitemapEntries,
  tradeSuburbSitemapEntries,
  type BlogSitemapRow,
  type ListingSitemapRow,
  type TradeSuburbSitemapRow,
} from "@/lib/seo/sitemapEntries";

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
const BASE_URL = CANONICAL_ORIGIN;

export const revalidate = 86400; // 24 hours

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── 1. Static pages ──────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                       changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE_URL}/directory`,        changeFrequency: "daily",   priority: 0.9 },
    ...(LEADS_ENABLED ? [{ url: `${BASE_URL}/get-quotes`, changeFrequency: "monthly" as const, priority: 0.8 }] : []),
    { url: `${BASE_URL}/blog`,             changeFrequency: "weekly",  priority: 0.7 },
    // Per-trade SaaS landing pages. These carry the "quoting software for
    // {trade}" keywords, which previously had no page behind them at all.
    ...TRADE_PAGES.map((t) => ({
      url: `${BASE_URL}/quoting-software/${t.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
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
    { url: `${BASE_URL}/terms`,            changeFrequency: "yearly",  priority: 0.2 },
    { url: `${BASE_URL}/privacy`,          changeFrequency: "yearly",  priority: 0.2 },
  ];

  // Missing credentials, and CI's placeholder Supabase host, both return
  // the static sitemap. A live fetch failure below still throws: that is
  // a production read, and swallowing it would publish a short sitemap.
  if (!sitemapShouldQueryDatabase({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  })) {
    return staticPages;
  }

  const admin = createAdminClient();

  // PostgREST caps each response at 1,000 rows. An unpaged
  // directory_listing select therefore published exactly 1,000 canonical
  // listing URLs (live sitemap: 1,765 total, 1,000 directory locs, the
  // rest of the public listings absent) even though those pages 200 with
  // a self-referencing canonical. Page every dynamic source on a stable
  // id order until a short page. A failed page throws: swallowing it
  // would publish another quietly truncated sitemap with HTTP 200.
  //
  // Eligibility is unchanged. Listings still require business_name and
  // suburb. Trade×suburb and suburb hubs still require is_indexed and
  // the 3-listing floor (those pages are noindex below it). Blog drafts
  // stay out. UUID paths are never emitted; /directory/[uuid] 308s to
  // the pretty slug built by directoryProfilePath.

  // The three tables are independent. Pages within one table stay
  // sequential (offset paging); the tables themselves do not.
  const [listingRows, tradeRows, blogRows] = await Promise.all([
    fetchAllPages<ListingSitemapRow>(async (from, pageSize) => {
      const { data, error } = await admin
        .from("directory_listing")
        .select("id, business_name, suburb, updated_at, created_at")
        .not("business_name", "is", null)
        .not("suburb", "is", null)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`[sitemap] listings fetch failed: ${error.message}`);
      return data ?? [];
    }),
    // Source directly from trade_suburb_pages - same table the actual
    // trade+suburb and suburb-hub pages read from, already has correct
    // per-listing state (derived from postcode, not a hardcoded "vic").
    // is_indexed is the deliberate noindex flag from the SEO refresh.
    fetchAllPages<TradeSuburbSitemapRow>(async (from, pageSize) => {
      const { data, error } = await admin
        .from("trade_suburb_pages")
        .select("trade, suburb, suburb_slug, state, listing_count, is_indexed")
        .eq("is_indexed", true)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`[sitemap] trade_suburb_pages fetch failed: ${error.message}`);
      return (data ?? []).map((r) => ({
        trade: r.trade,
        suburb: r.suburb,
        suburbSlug: r.suburb_slug,
        state: r.state,
        count: r.listing_count ?? 0,
        isIndexed: r.is_indexed,
      }));
    }),
    // Published only: `published = false` rows are drafts and must never be
    // exposed here, since a sitemap entry is a crawl invitation and
    // /blog/[slug] 404s on unpublished slugs anyway.
    fetchAllPages<BlogSitemapRow>(async (from, pageSize) => {
      const { data, error } = await admin
        .from("blog_posts")
        .select("slug, published, published_at, updated_at, created_at")
        .eq("published", true)
        .not("slug", "is", null)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`[sitemap] blog posts fetch failed: ${error.message}`);
      return data ?? [];
    }),
  ]);

  const listingPages = listingSitemapEntries(listingRows, BASE_URL);
  const programmaticPages = tradeSuburbSitemapEntries(tradeRows, BASE_URL);
  const suburbPages = suburbHubSitemapEntries(tradeRows, BASE_URL);
  const blogPages = blogSitemapEntries(blogRows, BASE_URL);

  return [...staticPages, ...listingPages, ...programmaticPages, ...suburbPages, ...blogPages];
}
