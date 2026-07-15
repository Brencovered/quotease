/**
 * lib/seo/meta.ts
 * ---------------
 * Generates consistent <Metadata> objects for every SEO-relevant page type.
 *
 * ASSUMPTIONS:
 * - Canonical domain is swiftscope.com.au (no www).
 * - Trade×suburb URLs follow the pattern /electricians-seaford-vic (plural
 *   trade slug + suburb slug + state). State defaults to "vic" until we
 *   have postcode→state mapping.
 * - OG image falls back to a static card if no logo is available.
 * - Pricing copy is manually maintained here; will be pulled from a DB
 *   table in Prompt 2 once trade_suburb_pages exists.
 */

import type { Metadata } from "next";

const BASE_URL = "https://www.swiftscope.com.au";
const DEFAULT_OG = `${BASE_URL}/og-default-image`; // generated on request, see app/og-default-image/route.tsx

// -- Canonical helpers ----------------------------------------------------

/** "electrician" -> "electricians" */
function tradeToSlug(trade: string): string {
  const IRREGULAR: Record<string, string> = {
    plumber:         "plumbers",
    electrician:     "electricians",
    builder:         "builders",
    roofer:          "roofers",
    painter:         "painters",
    carpenter:       "carpenters",
    tiler:           "tilers",
    landscaper:      "landscapers",
    arborist:        "arborists",
    concreter:       "concreters",
    fencer:          "fencers",
    aircon:          "air-conditioning",
    surveyor:        "surveyors",
    "air conditioning": "air-conditioning",
  };
  return IRREGULAR[trade.toLowerCase()] ?? `${trade.toLowerCase()}s`;
}

/** "South Melbourne" -> "south-melbourne" */
function suburbToSlug(suburb: string): string {
  return suburb.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function tradeSuburbCanonical(trade: string, suburb: string, state = "vic"): string {
  return `${BASE_URL}/${tradeToSlug(trade)}-${suburbToSlug(suburb)}-${state}`;
}

export function directoryListingCanonical(slug: string): string {
  return `${BASE_URL}/directory/${slug}`;
}

/**
 * Builds the pretty, business-name-bearing slug for a directory listing -
 * e.g. "all-metal-roof-plumbing-langwarrin-e77c5f" - instead of exposing
 * the raw UUID in the URL. The trailing 6 hex chars (stripped of hyphens)
 * of the row's real id guarantee uniqueness even if two businesses in the
 * same suburb share a name, without needing a dedicated slug column.
 *
 * Single source of truth: this used to be duplicated identically in
 * app/sitemap.ts and lib/seo/generateTradeSuburbContent.ts. Both now
 * import this instead, so the sitemap, the SEO landing pages, the
 * directory search cards, and the listing page's own slug resolution
 * (app/directory/[slug]/page.tsx) can never drift out of sync with each
 * other again.
 */
export function buildDirectorySlug(row: { id: string; business_name: string; suburb: string }): string {
  const name = row.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const sub  = (row.suburb || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const uid  = row.id.replace(/-/g, "").slice(-6);
  // A blank suburb collapses the middle segment rather than leaving a
  // stray double hyphen (e.g. "business-name--abc123") - name+uid is
  // still unique and readable even without a suburb.
  return sub ? `${name}-${sub}-${uid}` : `${name}-${uid}`;
}

// -- Trade display names --------------------------------------------------

const TRADE_DISPLAY: Record<string, { singular: string; plural: string }> = {
  electrician:     { singular: "Electrician",     plural: "Electricians" },
  plumber:         { singular: "Plumber",          plural: "Plumbers" },
  builder:         { singular: "Builder",          plural: "Builders" },
  roofer:          { singular: "Roofer",           plural: "Roofers" },
  painter:         { singular: "Painter",          plural: "Painters" },
  carpenter:       { singular: "Carpenter",        plural: "Carpenters" },
  tiler:           { singular: "Tiler",            plural: "Tilers" },
  landscaper:      { singular: "Landscaper",       plural: "Landscapers" },
  arborist:        { singular: "Arborist",         plural: "Arborists" },
  concreter:       { singular: "Concreter",        plural: "Concreters" },
  fencer:          { singular: "Fencer",           plural: "Fencers" },
  aircon:          { singular: "Air Con Installer", plural: "Air Con Installers" },
  surveyor:        { singular: "Surveyor",         plural: "Surveyors" },
};

export function getTradeDisplay(trade: string) {
  return TRADE_DISPLAY[trade.toLowerCase()] ?? { singular: trade, plural: `${trade}s` };
}

// -- Page-level Metadata generators ---------------------------------------

export function homepageMeta(): Metadata {
  const title       = "Swiftscope - Scope, Quote & Win Jobs On Site | Built for Tradies";
  const description = "Quoting software built site-first for trade teams of 1-10. Scope, quote and send before you leave the driveway. Homeowners get free quotes from local tradies.";
  return {
    title,
    description,
    alternates: { canonical: BASE_URL },
    openGraph: {
      title,
      description,
      url: BASE_URL,
      siteName: "Swiftscope",
      images: [{ url: DEFAULT_OG, width: 1200, height: 630, alt: "Swiftscope - find local tradies" }],
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description, images: [DEFAULT_OG] },
    robots: { index: true, follow: true },
  };
}

export function tradeSuburbMeta(
  trade: string,
  suburb: string,
  state = "vic",
  listingCount = 0,
  avgRating?: number
): Metadata {
  const { plural } = getTradeDisplay(trade);
  const stateUpper = state.toUpperCase();
  const canonical  = tradeSuburbCanonical(trade, suburb, state);

  const ratingSnippet = avgRating ? ` (avg ${avgRating.toFixed(1)}★)` : "";
  const title       = `${plural} in ${suburb} ${stateUpper} | Compare Quotes - Swiftscope`;
  const description = listingCount > 0
    ? `Compare ${listingCount} local ${plural.toLowerCase()} in ${suburb}${ratingSnippet}. Get free quotes instantly. Verified reviews, upfront pricing, no call-centre.`
    : `Find trusted ${plural.toLowerCase()} in ${suburb} ${stateUpper}. Get up to 3 free quotes from verified local tradies on Swiftscope.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Swiftscope",
      images: [{ url: DEFAULT_OG, width: 1200, height: 630, alt: `${plural} in ${suburb}` }],
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description, images: [DEFAULT_OG] },
    robots: { index: listingCount >= 3, follow: true }, // NOTE: don't index thin pages with < 3 listings
  };
}

export function tradieListingMeta(listing: {
  business_name: string;
  trades: string[];
  suburb: string;
  blurb?: string | null;
  google_rating?: number | null;
  google_reviews_count?: number | null;
  logo_url?: string | null;
  slug: string; // NOTE: assumes a stable slug exists on the listing -- add this column if needed
}): Metadata {
  const trade     = listing.trades[0] ?? "tradie";
  const { singular } = getTradeDisplay(trade);
  const canonical = directoryListingCanonical(listing.slug);

  const ratingSnippet = listing.google_rating
    ? ` - ${listing.google_rating}★ (${listing.google_reviews_count ?? 0} reviews)`
    : "";
  const title       = `${listing.business_name} | ${singular} in ${listing.suburb}${ratingSnippet} - Swiftscope`;
  const description = listing.blurb
    ? listing.blurb.slice(0, 155)
    : `${listing.business_name} is a ${singular.toLowerCase()} based in ${listing.suburb}. Get a free quote on Swiftscope.`;

  const image = listing.logo_url ?? DEFAULT_OG;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Swiftscope",
      images: [{ url: image, width: 800, height: 800, alt: listing.business_name }],
      type: "profile",
    },
    twitter: { card: "summary", title, description, images: [image] },
    robots: { index: true, follow: true },
  };
}

export function directoryMeta(): Metadata {
  const title       = "Find Local Tradies Near You | Swiftscope Directory";
  const description = "Browse verified electricians, plumbers, builders and more across Australia. Real Google reviews. Get free quotes in minutes.";
  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/directory` },
    openGraph: {
      title, description,
      url: `${BASE_URL}/directory`,
      siteName: "Swiftscope",
      images: [{ url: DEFAULT_OG, width: 1200, height: 630, alt: "Swiftscope tradie directory" }],
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description, images: [DEFAULT_OG] },
    robots: { index: true, follow: true },
  };
}

// -- Export helpers for use in generateStaticParams etc. -----------------

export { tradeToSlug, suburbToSlug };

// -- Reverse lookup: plural trade slug -> internal trade key -------------
// Built from TRADE_DISPLAY plus the irregular plurals in tradeToSlug().
const SLUG_TO_TRADE: Record<string, string> = {
  electricians: "electrician",
  plumbers: "plumber",
  builders: "builder",
  roofers: "roofer",
  painters: "painter",
  carpenters: "carpenter",
  tilers: "tiler",
  landscapers: "landscaper",
  arborists: "arborist",
  concreters: "concreter",
  fencers: "fencer",
  "air-conditioning": "aircon",
  surveyors: "surveyor",
};

const VALID_STATE_SLUGS = ["vic", "nsw", "qld", "wa", "sa", "tas", "act", "nt"];

export function getSlugToTradeMap(): Record<string, string> {
  return SLUG_TO_TRADE;
}

/**
 * Parses a combined URL segment like "electricians-seaford-vic" into its
 * trade / suburb / state parts.
 *
 * Format is {tradePluralSlug}-{suburb-slug...}-{stateSlug}. The suburb slug
 * itself may contain hyphens (e.g. "south-melbourne"), so this works by
 * peeling a known trade slug off the front and a known state slug off the
 * back, treating whatever's left in the middle as the suburb.
 *
 * Returns null if the segment doesn't match a known trade or state -- the
 * page component should call notFound() in that case.
 */
export function parseTradeSuburbSlug(segment: string): { trade: string; suburbSlug: string; state: string } | null {
  if (typeof segment !== "string" || !segment) return null;
  const parts = segment.split("-");
  if (parts.length < 3) return null;

  const state = parts[parts.length - 1];
  if (!VALID_STATE_SLUGS.includes(state)) return null;

  // Trade slugs can themselves be multi-word ("air-conditioning"), so try
  // progressively longer prefixes against the known slug map.
  const knownSlugs = Object.keys(SLUG_TO_TRADE).sort((a, b) => b.split("-").length - a.split("-").length);
  for (const slug of knownSlugs) {
    const slugParts = slug.split("-");
    const candidate = parts.slice(0, slugParts.length).join("-");
    if (candidate === slug) {
      const suburbSlug = parts.slice(slugParts.length, -1).join("-");
      if (!suburbSlug) return null;
      return { trade: SLUG_TO_TRADE[slug], suburbSlug, state };
    }
  }
  return null;
}

/** "south-melbourne" -> "South Melbourne" (best-effort, used as a fallback
 *  display name before the real suburb casing is confirmed against the DB). */
export function slugToSuburbDisplay(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Parses a suburb-only URL segment like "seaford-vic" into suburb/state -
 * the counterpart to parseTradeSuburbSlug but with no trade prefix, for
 * the "Tradies in {Suburb}" all-trades landing page. Same peel-the-state-
 * off-the-back approach, since the suburb slug itself may contain hyphens.
 */
export function parseSuburbSlug(segment: string): { suburbSlug: string; state: string } | null {
  if (typeof segment !== "string" || !segment) return null;
  const parts = segment.split("-");
  if (parts.length < 2) return null;
  const state = parts[parts.length - 1];
  if (!VALID_STATE_SLUGS.includes(state)) return null;
  const suburbSlug = parts.slice(0, -1).join("-");
  if (!suburbSlug) return null;
  return { suburbSlug, state };
}

export function suburbLandingCanonical(suburbSlug: string, state: string): string {
  return `${BASE_URL}/tradies-in-${suburbSlug}-${state}`;
}
