/**
 * components/seo/TradieSchema.tsx
 * --------------------------------
 * Renders Schema.org JSON-LD for a tradie directory listing.
 *
 * Uses two overlapping types:
 *   - LocalBusiness  (Google's preferred type for local service businesses)
 *   - HomeAndConstructionBusiness (more specific, still well-supported)
 *
 * ASSUMPTIONS:
 * - address.addressRegion defaults to "VIC" -- will need state data for
 *   other states once listings expand beyond Victoria.
 * - telephone is from scraped_contact_phone; some listings won't have it.
 * - priceRange is hardcoded as "$$" (mid-range) -- no pricing data on
 *   individual listings yet. Can be personalised once claimed tradies
 *   set their own hourly rate on the profile.
 * - geo coordinates come from the directory_listing table directly.
 * - aggregateRating is only emitted when both rating and reviews_count
 *   are present and reviews_count >= 3 (Google ignores ratings with < 3
 *   reviews and may penalise for self-reported single-review ratings).
 */

interface TradieSchemaProps {
  businessName: string;
  trade: string;
  suburb: string;
  state?: string;
  country?: string;
  streetAddress?: string | null;
  postcode?: string | null;
  phone?: string | null;
  website?: string | null;
  logo?: string | null;
  googleRating?: number | null;
  reviewCount?: number | null;
  lat?: number | null;
  lng?: number | null;
  slug: string; // used to build the canonical URL
}

// Maps internal trade keys to Schema.org @type values.
// Ref: https://schema.org/HomeAndConstructionBusiness subtypes
const TRADE_SCHEMA_TYPE: Record<string, string> = {
  electrician:  "Electrician",
  plumber:      "Plumber",
  painter:      "HousePainter",
  roofer:       "RoofingContractor",
  carpenter:    "GeneralContractor",
  builder:      "GeneralContractor",
  landscaper:   "LandscapingBusiness",
  tiler:        "HomeAndConstructionBusiness",
  concreter:    "HomeAndConstructionBusiness",
  arborist:     "LocalBusiness",
  fencer:       "HomeAndConstructionBusiness",
  aircon:       "HVACBusiness",
  surveyor:     "LocalBusiness",
};

const BASE_URL = "https://swiftscope.com.au";

export default function TradieSchema({
  businessName,
  trade,
  suburb,
  state = "VIC",
  country = "AU",
  streetAddress,
  postcode,
  phone,
  website,
  logo,
  googleRating,
  reviewCount,
  lat,
  lng,
  slug,
}: TradieSchemaProps) {
  const schemaType = TRADE_SCHEMA_TYPE[trade.toLowerCase()] ?? "LocalBusiness";
  const canonicalUrl = `${BASE_URL}/directory/${slug}`;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: businessName,
    url: website ?? canonicalUrl,
    sameAs: [canonicalUrl],
    address: {
      "@type": "PostalAddress",
      ...(streetAddress && { streetAddress }),
      addressLocality: suburb,
      addressRegion: state,
      postalCode: postcode ?? undefined,
      addressCountry: country,
    },
    ...(lat && lng && {
      geo: {
        "@type": "GeoCoordinates",
        latitude: lat,
        longitude: lng,
      },
    }),
    ...(phone && { telephone: phone }),
    ...(logo && {
      logo: { "@type": "ImageObject", url: logo },
      image: logo,
    }),
    // priceRange: "$$", // NOTE: uncomment and customise once we have per-listing pricing data
    areaServed: {
      "@type": "City",
      name: suburb,
    },
    // Only emit aggregateRating when we have enough reviews to be credible.
    ...(googleRating && reviewCount && reviewCount >= 3 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: googleRating.toFixed(1),
        reviewCount: reviewCount,
        bestRating: "5",
        worstRating: "1",
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ── Directory/listing-list schema ─────────────────────────────────────────

interface DirectoryPageSchemaProps {
  trade: string;
  suburb: string;
  state?: string;
  listings: Array<{
    business_name: string;
    slug: string;
    google_rating?: number | null;
    google_reviews_count?: number | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
  }>;
}

/**
 * ItemList schema for trade×suburb pages.
 * Tells Google this page is a curated list of local businesses.
 */
export function DirectoryPageSchema({ trade, suburb, state = "VIC", listings }: DirectoryPageSchemaProps) {
  const { plural } = { plural: `${trade}s` }; // simplified -- lib/seo/meta.ts has the full map
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${plural} in ${suburb} ${state} — Swiftscope`,
    description: `Verified ${plural.toLowerCase()} serving ${suburb} and surrounds.`,
    numberOfItems: listings.length,
    itemListElement: listings.map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE_URL}/directory/${l.slug}`,
      name: l.business_name,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
