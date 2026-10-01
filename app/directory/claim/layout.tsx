import type { Metadata } from "next";

/**
 * An SEO audit flagged ~2,674 distinct /directory/claim?name=...&
 * suburb=...&trade=... URLs, each with "thin content" (0 word count),
 * "missing H1", and "page has no outgoing links" - all the same
 * underlying cause.
 *
 * How they were discovered: every unclaimed listing renders a "claim
 * this listing" link prefilled with that business's own details -
 * app/directory/[slug]/page.tsx (two places) and
 * components/DirectoryCard.tsx (once per card across every /directory
 * search results page). Thousands of listings means thousands of
 * distinct, crawlable claim URLs, every one rendering the same form.
 * The form itself is a client component (reads the prefill via
 * useSearchParams), so its actual content only exists after JS runs -
 * a crawler reading the server-rendered HTML sees an empty page,
 * which is exactly what "thin content" and "no H1" are reporting.
 *
 * Two things wrong with that: it burns crawl budget that should go to
 * the trade/suburb pages actually meant to rank, and a claim form is
 * an action page - there's no version of it that belongs in search
 * results at all.
 *
 * The page itself can't export metadata (client component), hence
 * this layout. Paired with rel="nofollow" on every link that points
 * here with query params, so new variants stop being discovered going
 * forward, not just the ones already indexed.
 *
 * Deliberately NOT added to robots.ts disallow: these URLs are likely
 * already indexed, and a Disallow would stop Googlebot from fetching
 * them at all - meaning it would never see the noindex below and they
 * would linger in the index indefinitely. Left crawlable so Googlebot
 * can read the noindex and drop them out naturally.
 *
 * Token-based outreach claim links (?token=...) still work fine -
 * noindex affects indexing, not access.
 */
export const metadata: Metadata = {
  title: "Claim your listing | SwiftScope",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  // Points every param variant at the bare path, so any that do get
  // crawled anyway consolidate to one URL instead of competing as
  // near-duplicates with each other.
  alternates: { canonical: "https://swiftscope.com.au/directory/claim" },
};

export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
