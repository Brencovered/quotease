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

const BASE_URL = "https://swiftscope.com.au";
const DEFAULT_OG = `${BASE_URL}/og-default.jpg`; // NOTE: create this 1200×630 card in /public

// ── Canonical helpers ─────────────────────────────────────────────────────

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

// ── Trade display names ───────────────────────────────────────────────────

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

// ── Page-level Metadata generators ───────────────────────────────────────

export function homepageMeta(): Metadata {
  const title       = "Swiftscope — Find Local Tradies & Instant Online Quotes";
  const description = "Get up to 3 quotes from verified local tradies. Free for homeowners. Electricians, plumbers, builders and more across Victoria, NSW & QLD.";
  return {
    title,
    description,
    alternates: { canonical: BASE_URL },
    openGraph: {
      title,
      description,
      url: BASE_URL,
      siteName: "Swiftscope",
      images: [{ url: DEFAULT_OG, width: 1200, height: 630, alt: "Swiftscope — find local tradies" }],
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
  const title       = `${plural} in ${suburb} ${stateUpper} | Compare Quotes — Swiftscope`;
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
    ? ` — ${listing.google_rating}★ (${listing.google_reviews_count ?? 0} reviews)`
    : "";
  const title       = `${listing.business_name} | ${singular} in ${listing.suburb}${ratingSnippet} — Swiftscope`;
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

// ── Export helpers for use in generateStaticParams etc. ──────────────────

export { tradeToSlug, suburbToSlug };
