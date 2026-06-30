/**
 * lib/seo/gbp.ts
 * ---------------
 * Google Business Profile helpers.
 *
 * Two very different categories of function in here -- read the split
 * carefully before using either:
 *
 * 1. REAL AND WORKING TODAY: review/reviews-page URL generators. These use
 *    public, unauthenticated Google Maps/Search URL patterns -- no API key,
 *    no OAuth, nothing to configure. (components/DirectoryCard.tsx already
 *    has an inline version of one of these; this file is the canonical
 *    version other code should import instead of re-implementing it.)
 *
 * 2. NOT IMPLEMENTED, HONESTLY SCAFFOLDED: actually posting to a tradie's
 *    Google Business Profile (GBP "Posts", responding to reviews, updating
 *    business hours, etc) requires the Google Business Profile API, which
 *    needs EACH TRADIE to individually OAuth-connect their own GBP account
 *    to Swiftscope -- there is no way to post on a business's behalf with
 *    just our own service account, the way the Search Console wrapper
 *    works. That's a real feature (OAuth flow, token storage per tradie,
 *    consent screen, Google API access review since GBP API has stricter
 *    quota/approval requirements than most Google APIs) -- not a "couple
 *    of functions" addition. What's here instead is well-written copy
 *    templates a tradie could paste into GBP manually today, which needs
 *    zero infrastructure and is useful immediately.
 */

// ── 1. Review URL generators (real, working, no auth required) ──────────

/**
 * Deep-links to a business's Google written-reviews list. Unofficial but
 * stable pattern, degrades gracefully to a normal Maps search if Google
 * ever changes behaviour. Matches the pattern already used inline in
 * components/DirectoryCard.tsx -- import from here going forward instead
 * of duplicating the URL.
 */
export function getGoogleReviewsUrl(placeId: string): string {
  return `https://search.google.com/local/reviews?placeid=${encodeURIComponent(placeId)}`;
}

/**
 * Deep-links straight to the "write a review" flow for a business. Useful
 * for the post-job follow-up email/SMS asking a happy client for a review.
 */
export function getGoogleWriteReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

/**
 * Standard Google Maps URL for a place -- useful as a generic "find us on
 * Google Maps" link when a review-specific deep link isn't appropriate.
 */
export function getGoogleMapsUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

// ── 2. GBP post copy templates (manual-paste, no API integration) ───────

export interface GbpPostTemplate {
  key: string;
  label: string;
  /** {{businessName}}, {{suburb}}, {{trade}} get replaced -- see fillTemplate() */
  body: string;
}

export const GBP_POST_TEMPLATES: GbpPostTemplate[] = [
  {
    key: "review_request",
    label: "Ask for a review",
    body: "Just finished another job in {{suburb}}! If we've worked on your place recently, we'd really appreciate a quick Google review -- it helps other locals find a {{trade}} they can trust.",
  },
  {
    key: "availability",
    label: "Booking availability",
    body: "{{businessName}} has openings this week for {{suburb}} and surrounding areas. Get in touch for a free quote -- we usually respond within a few hours.",
  },
  {
    key: "seasonal",
    label: "Seasonal reminder",
    body: "Now's a good time to get your {{trade}} job sorted before things get busy. {{businessName}} is taking bookings in {{suburb}} -- reach out for a free, no-obligation quote.",
  },
  {
    key: "milestone",
    label: "Job milestone / social proof",
    body: "Another happy customer in {{suburb}}! Thanks for trusting {{businessName}} with your job. If you need a reliable {{trade}}, we'd love to hear from you.",
  },
];

/** Fills {{businessName}}, {{suburb}}, {{trade}} placeholders in a template body. */
export function fillGbpTemplate(template: GbpPostTemplate, vars: { businessName: string; suburb: string; trade: string }): string {
  return template.body
    .replaceAll("{{businessName}}", vars.businessName)
    .replaceAll("{{suburb}}", vars.suburb)
    .replaceAll("{{trade}}", vars.trade);
}
