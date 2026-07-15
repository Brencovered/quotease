/**
 * lib/seo/generateTradeSuburbContent.ts
 * ---------------------------------------
 * Pulls real data from Supabase and assembles everything a trade×suburb
 * page needs: matching listings, an aggregate rating, a pricing snippet,
 * and FAQ content.
 *
 * Used by app/[tradeSuburb]/page.tsx.
 *
 * ASSUMPTIONS:
 * - "Pricing data" doesn't exist anywhere yet (no per-trade average job
 *   cost table). The PRICING_RANGES map below is a manually-maintained
 *   set of rough Australian market ranges per trade, used only as
 *   illustrative copy ("Typical jobs range from $X-$Y") with a visible
 *   disclaimer that it's a general guide, not Swiftscope-sourced data.
 *   Replace with real aggregated quote data once there's enough volume
 *   to be statistically meaningful (and worth getting legal/compliance
 *   eyes on before publishing "real" pricing claims).
 * - "Top 5 tradies" = top 5 by Google rating then review count, with a
 *   minimum review count floor (3) so a single 5-star review doesn't
 *   outrank a well-reviewed business with a 4.6.
 * - State is passed in from the URL slug (parsed in the page component)
 *   since directory_listing doesn't store state directly yet.
 */

import { createClient } from "@/lib/supabase/server";
import { getTradeDisplay, suburbToSlug, slugToSuburbDisplay, buildDirectorySlug } from "@/lib/seo/meta";
import { generateTradeSuburbFaqs, type FaqItem } from "@/components/seo/FaqSchema";

export interface TradeSuburbListing {
  id: string;
  business_name: string;
  slug: string;
  trades: string[];
  suburb: string;
  google_rating: number | null;
  google_reviews_count: number | null;
  logo_url: string | null;
  photo_references: string[] | null;
  blurb: string | null;
  scraped_contact_phone: string | null;
  website_url: string | null;
}

export interface TradeSuburbContent {
  trade: string;
  tradeSingular: string;
  tradePlural: string;
  suburb: string;
  state: string;
  listings: TradeSuburbListing[];
  listingCount: number;
  avgRating: number | null;
  totalReviews: number;
  topListings: TradeSuburbListing[];
  pricingRange: string | null;
  faqs: FaqItem[];
  /** false when listingCount is below the indexing threshold -- the page
   *  component should still render (good for conversions / internal
   *  linking) but lib/seo/meta.ts will mark it noindex. */
  hasEnoughListingsToIndex: boolean;
}

const MIN_LISTINGS_FOR_INDEX = 3;
const TOP_LISTINGS_COUNT = 5;
const MIN_REVIEWS_FOR_RANKING = 3;

// NOTE: illustrative only, not derived from real Swiftscope quote data.
// Manually maintained -- update periodically or replace with real
// aggregated data once volume supports it. AUD, ex-GST, rough national
// averages for common residential jobs as of mid-2026.
const PRICING_RANGES: Record<string, string> = {
  electrician: "$80–$150 for a standard callout, $400–$1,500+ for switchboard upgrades",
  plumber:     "$80–$150 for a standard callout, $300–$1,200+ for hot water unit replacement",
  builder:     "$1,500–$5,000+ for small renovations, much higher for extensions",
  roofer:      "$50–$120 per square metre for re-roofing depending on material",
  painter:     "$30–$50 per square metre for interior repainting",
  carpenter:   "$70–$120 per hour, with material costs on top",
  tiler:       "$60–$100 per square metre installed, excluding tiles",
  landscaper:  "$3,000–$15,000+ for a typical backyard makeover",
  concreter:   "$60–$100 per square metre for a standard slab",
  fencer:      "$50–$150 per linear metre depending on fence type",
  aircon:      "$2,500–$6,000 installed for a split system",
  surveyor:    "$600–$2,500 depending on the type of survey required",
  arborist:    "$300–$2,000+ depending on tree size and access",
};

// buildSlug moved to lib/seo/meta.ts as buildDirectorySlug - was
// duplicated identically here and in app/sitemap.ts.
const buildSlug = buildDirectorySlug;

export async function generateTradeSuburbContent(
  trade: string,
  suburbSlug: string,
  state: string
): Promise<TradeSuburbContent> {
  const supabase = await createClient();
  const { singular, plural } = getTradeDisplay(trade);

  // directory_listing stores suburb names with proper casing/spacing
  // (e.g. "South Melbourne"), but the URL only has a slug
  // ("south-melbourne"). Rather than guess at a SQL pattern that handles
  // every punctuation/casing variant, pull every listing for the trade and
  // match in code by re-slugifying each row's suburb -- small dataset,
  // simpler and more reliable than fragile ILIKE patterns.
  const { data: tradeRows, error } = await supabase
    .from("directory_listing")
    .select("id, business_name, trades, suburb, google_rating, google_reviews_count, logo_url, photo_references, blurb, scraped_contact_phone, website_url")
    .contains("trades", [trade]);

  if (error) {
    console.error("[generateTradeSuburbContent] query failed:", error.message);
  }

  const rows = (tradeRows ?? []).filter((r) => r.suburb && suburbToSlug(r.suburb) === suburbSlug);
  const suburb = rows[0]?.suburb ?? slugToSuburbDisplay(suburbSlug);

  const listings: TradeSuburbListing[] = rows.map((r) => ({
    ...r,
    slug: buildSlug(r),
  }));

  const listingCount = listings.length;

  const ratedListings = listings.filter((l) => l.google_rating != null && (l.google_reviews_count ?? 0) >= MIN_REVIEWS_FOR_RANKING);
  const avgRating = ratedListings.length > 0
    ? ratedListings.reduce((s, l) => s + (l.google_rating ?? 0), 0) / ratedListings.length
    : null;
  const totalReviews = listings.reduce((s, l) => s + (l.google_reviews_count ?? 0), 0);

  const topListings = [...ratedListings]
    .sort((a, b) => {
      const ratingDiff = (b.google_rating ?? 0) - (a.google_rating ?? 0);
      if (Math.abs(ratingDiff) > 0.05) return ratingDiff;
      return (b.google_reviews_count ?? 0) - (a.google_reviews_count ?? 0);
    })
    .slice(0, TOP_LISTINGS_COUNT);

  // If there aren't enough rated listings to fill the top list, pad with
  // unrated ones so the page doesn't look sparse for a brand-new suburb.
  if (topListings.length < TOP_LISTINGS_COUNT) {
    const remaining = listings.filter((l) => !topListings.includes(l)).slice(0, TOP_LISTINGS_COUNT - topListings.length);
    topListings.push(...remaining);
  }

  const faqs = generateTradeSuburbFaqs(singular, plural, suburb, state.toUpperCase(), listingCount, avgRating ?? undefined);

  return {
    trade,
    tradeSingular: singular,
    tradePlural: plural,
    suburb,
    state: state.toUpperCase(),
    listings,
    listingCount,
    avgRating,
    totalReviews,
    topListings,
    pricingRange: PRICING_RANGES[trade.toLowerCase()] ?? null,
    faqs,
    hasEnoughListingsToIndex: listingCount >= MIN_LISTINGS_FOR_INDEX,
  };
}
