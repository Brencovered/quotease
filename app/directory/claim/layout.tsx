import type { Metadata } from "next";

/**
 * Search Console reported 250 URLs under "Duplicate without user-selected
 * canonical", every one of them /directory/claim with name, suburb and trade
 * query params.
 *
 * How they were discovered: app/directory/[slug]/page.tsx renders a "claim
 * this listing" link on every public listing page, prefilled with that
 * business's details. There are 4,889 listing pages, so Googlebot had a
 * crawlable path to a distinct claim URL for each one. Every one of those
 * renders the same form, so Google correctly identified them as duplicates
 * and had to pick a canonical itself.
 *
 * Two things wrong with that. It burns crawl budget that should be going to
 * the trade and suburb pages we actually want indexed, and a claim form is
 * an action page: there is no version of it that belongs in search results.
 *
 * The fix is metadata, which the page itself cannot export because it is a
 * client component (it reads the prefill via useSearchParams). Hence this
 * layout.
 *
 * Deliberately NOT added to robots.ts disallow. These URLs are already in
 * Google's index, and a Disallow would stop Googlebot fetching them, which
 * means it would never see the noindex below and they would linger
 * indefinitely. Let it crawl, let it read noindex, let them drop out. A
 * Disallow can be considered later, once the index is clean.
 *
 * The listing-page link also gets rel="nofollow" so new param variants stop
 * being discovered in the first place.
 */
export const metadata: Metadata = {
  title: "Claim your listing | Swiftscope",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  // Points at the bare path so any param variant that is crawled anyway
  // consolidates to one URL rather than competing with its siblings.
  alternates: { canonical: "https://swiftscope.com.au/directory/claim" },
};

export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
