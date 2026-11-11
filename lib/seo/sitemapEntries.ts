import { directoryProfilePath } from "@/lib/seo/directoryUrl";
import { tradeToSlug } from "@/lib/seo/meta";

/**
 * Canonical origin for every sitemap URL. www 308s to this host; putting
 * the other host in the sitemap asks Google to crawl a redirect.
 */
export const CANONICAL_ORIGIN = "https://swiftscope.com.au";

/**
 * CI's build step sets a placeholder Supabase URL and service key so
 * `next build` can prerender without production credentials. Querying
 * that host throws, and a thrown sitemap prerender fails the build.
 * Production still queries, and a failed page there still throws so a
 * short read is not published as a complete sitemap.
 */
export function sitemapShouldQueryDatabase(env: { url?: string | null; serviceKey?: string | null }): boolean {
  const url = env.url?.trim() ?? "";
  const serviceKey = env.serviceKey?.trim() ?? "";
  if (!url || !serviceKey) return false;
  if (url.includes("placeholder.supabase.co")) return false;
  if (serviceKey.startsWith("placeholder")) return false;
  return true;
}

/**
 * Same thin-page threshold as tradeSuburbMeta and the suburb hub pages.
 * Combinations under this stay out of the sitemap because those pages
 * are deliberately noindex.
 */
export const MIN_LISTINGS_FOR_INDEX = 3;

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
};

export type ListingSitemapRow = {
  id: string | null;
  business_name: string | null;
  suburb: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type TradeSuburbSitemapRow = {
  trade: string | null;
  suburb?: string | null;
  suburbSlug: string | null;
  state: string | null;
  count: number | null;
  isIndexed: boolean | null;
};

export type BlogSitemapRow = {
  slug: string | null;
  published?: boolean | null;
  published_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

/**
 * A directory row is sitemap-eligible when it is a public listing the
 * canonical page can address: a real id, business name, and suburb.
 *
 * There is no per-listing noindex/private/deleted flag. Removal deletes
 * the row (and directory_exclusions blocks reinsert). Null suburb is the
 * existing exclusion for listings that do not have a location segment;
 * blank names and suburbs are the same exclusion. private_email is a
 * contact column, not a visibility flag, and is not consulted.
 */
export function isSitemapEligibleListing(row: ListingSitemapRow): boolean {
  return Boolean(row.id?.trim() && row.business_name?.trim() && row.suburb?.trim());
}

function timestamp(raw: string | null | undefined): Date | undefined {
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function listingSitemapEntries(
  rows: readonly ListingSitemapRow[],
  origin = CANONICAL_ORIGIN,
): SitemapEntry[] {
  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];
  for (const row of rows) {
    if (!isSitemapEligibleListing(row)) continue;
    const url = `${origin}${directoryProfilePath({
      id: row.id!,
      business_name: row.business_name!,
      suburb: row.suburb,
    })}`;
    if (seen.has(url)) continue;
    seen.add(url);
    entries.push({
      url,
      lastModified: timestamp(row.updated_at ?? row.created_at),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }
  return entries;
}

export function tradeSuburbSitemapEntries(
  rows: readonly TradeSuburbSitemapRow[],
  origin = CANONICAL_ORIGIN,
): SitemapEntry[] {
  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];
  for (const row of rows) {
    if (row.isIndexed !== true) continue;
    if ((row.count ?? 0) < MIN_LISTINGS_FOR_INDEX) continue;
    if (!row.trade?.trim() || !row.suburbSlug?.trim() || !row.state?.trim()) continue;
    const url = `${origin}/${tradeToSlug(row.trade)}-${row.suburbSlug}-${row.state.toLowerCase()}`;
    if (seen.has(url)) continue;
    seen.add(url);
    entries.push({ url, changeFrequency: "weekly", priority: 0.8 });
  }
  return entries;
}

/**
 * One hub per suburb+state. Counts only is_indexed trade rows, matching
 * the previous sitemap query and the hub page's generateStaticParams
 * gate, and emits the hub only when that indexed total reaches
 * MIN_LISTINGS_FOR_INDEX. Suburb slug alone is not the key: the same
 * suburb name exists in more than one state, and keying only the slug
 * collapsed those into a single URL.
 */
export function suburbHubSitemapEntries(
  rows: readonly TradeSuburbSitemapRow[],
  origin = CANONICAL_ORIGIN,
): SitemapEntry[] {
  const totals = new Map<string, { suburbSlug: string; state: string; count: number }>();
  for (const row of rows) {
    if (row.isIndexed !== true) continue;
    if (!row.suburbSlug?.trim() || !row.state?.trim()) continue;
    const state = row.state.toLowerCase();
    const key = `${row.suburbSlug}-${state}`;
    const existing = totals.get(key);
    totals.set(key, {
      suburbSlug: row.suburbSlug,
      state,
      count: (existing?.count ?? 0) + (row.count ?? 0),
    });
  }
  return [...totals.values()]
    .filter((hub) => hub.count >= MIN_LISTINGS_FOR_INDEX)
    .map((hub) => ({
      url: `${origin}/tradies-in/${hub.suburbSlug}-${hub.state}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
}

/** Unpublished drafts and rows without a slug are not crawlable. */
export function blogSitemapEntries(
  rows: readonly BlogSitemapRow[],
  origin = CANONICAL_ORIGIN,
): SitemapEntry[] {
  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];
  for (const row of rows) {
    if (row.published === false) continue;
    if (!row.slug?.trim()) continue;
    const url = `${origin}/blog/${row.slug}`;
    if (seen.has(url)) continue;
    seen.add(url);
    entries.push({
      url,
      lastModified: timestamp(row.updated_at ?? row.published_at ?? row.created_at),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }
  return entries;
}
