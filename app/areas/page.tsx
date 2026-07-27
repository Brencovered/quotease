/**
 * app/areas/page.tsx
 * -------------------
 * "Areas we cover" -- the top of the hub-and-spoke SEO structure:
 * /areas (this page) -> /tradies-in/{suburb}-{state} -> /{trade}-{suburb}-{state}
 *
 * Lists every suburb with real, indexed coverage (trade_suburb_pages.is_indexed),
 * grouped by state, each linking to that suburb's "Tradies in {suburb}" hub
 * page. Exists so Google (and real visitors) have an actual crawlable path
 * to every trade x suburb page, rather than relying only on the sitemap
 * file -- internal links carry real weight that a sitemap entry alone
 * doesn't.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import MarketingNav from "@/components/MarketingNav";

export const revalidate = 604800; // 1 week, same cadence as the other SEO pages

export const metadata: Metadata = {
  title: "Areas we cover | Swiftscope Directory",
  description: "Every suburb and region where Swiftscope has curated, verified trade business listings across Australia.",
  alternates: { canonical: "https://www.swiftscope.com.au/areas" },
};

interface SuburbGroup {
  suburb: string;
  suburbSlug: string;
  state: string;
  tradeCount: number;
  totalListings: number;
}

const MIN_LISTINGS_FOR_INDEX = 3; // matches app/tradies-in/[suburbState]'s own threshold

async function loadAreas(): Promise<Record<string, SuburbGroup[]>> {
  const admin = createAdminClient();

  // Paginate explicitly - PostgREST silently caps an unpaginated select at
  // 1,000 rows, and trade_suburb_pages has 2,900+ rows.
  const PAGE_SIZE = 1000;
  const rows: { suburb: string; suburb_slug: string; state: string; listing_count: number | null; is_indexed: boolean }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page } = await admin
      .from("trade_suburb_pages")
      .select("suburb, suburb_slug, state, listing_count, is_indexed")
      .range(from, from + PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  // The real bug: this page only ever summed is_indexed=true rows, but a
  // suburb's own "Tradies in {suburb}" hub page
  // (app/tradies-in/[suburbState]) shows every trade present there,
  // indexed or not, once the suburb as a whole qualifies. Box Hill VIC is
  // the confirmed example - 7 trade rows/13 listings total, but only 1 of
  // those rows (electrician, 3 listings) individually crosses the
  // per-trade indexed threshold, so this page showed "1 trade - 3
  // listings" for a suburb whose own hub page correctly shows "7 trades -
  // 13 listings". Now sums ALL rows for display, and only uses the
  // is_indexed subset to decide whether the suburb qualifies to be listed
  // at all - the same qualification logic the hub page's own
  // generateStaticParams uses, so a suburb shown here is guaranteed to
  // actually render when clicked through.
  const bySuburb = new Map<string, SuburbGroup & { indexedListingSum: number }>();
  for (const row of rows) {
    const key = `${row.suburb_slug}-${row.state}`;
    const existing = bySuburb.get(key);
    const listingCount = row.listing_count ?? 0;
    if (existing) {
      existing.tradeCount += 1;
      existing.totalListings += listingCount;
      if (row.is_indexed) existing.indexedListingSum += listingCount;
    } else {
      bySuburb.set(key, {
        suburb: row.suburb,
        suburbSlug: row.suburb_slug,
        state: row.state,
        tradeCount: 1,
        totalListings: listingCount,
        indexedListingSum: row.is_indexed ? listingCount : 0,
      });
    }
  }

  // Only suburbs that actually qualify for their own hub page get listed
  // here - otherwise this page would link to a suburb whose hub page
  // 404s (the suburb hub route's own generateStaticParams gate).
  for (const [key, group] of bySuburb) {
    if (group.indexedListingSum < MIN_LISTINGS_FOR_INDEX) bySuburb.delete(key);
  }

  const grouped: Record<string, SuburbGroup[]> = {};
  for (const group of bySuburb.values()) {
    const stateKey = group.state.toUpperCase();
    (grouped[stateKey] ??= []).push(group);
  }
  for (const suburbs of Object.values(grouped)) {
    suburbs.sort((a, b) => b.totalListings - a.totalListings);
  }
  return grouped;
}

export default async function AreasPage() {
  const grouped = await loadAreas();
  const states = Object.keys(grouped).sort();
  const totalSuburbs = Object.values(grouped).reduce((sum, s) => sum + s.length, 0);

  return (
    <main className="min-h-screen bg-[var(--app-bg)]">
      <MarketingNav />

      <div className="bg-[#0a1722] py-14">
        <div className="max-w-5xl mx-auto px-6">
          <h1 className="font-display text-[2.4rem] sm:text-[3rem] text-white leading-tight mb-3">
            Areas we cover
          </h1>
          <p className="text-[15px] text-[#8aa4b4] max-w-xl">
            {totalSuburbs > 0
              ? `Curated tradie listings across ${totalSuburbs} suburbs and regions. Pick an area to see every trade we cover there.`
              : "Curated tradie listings across Australia."}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {states.length === 0 ? (
          <p className="text-[14px] text-[#5a6b78]">No indexed areas yet.</p>
        ) : (
          <div className="space-y-10">
            {states.map((state) => (
              <div key={state}>
                <h2 className="font-display text-[1.4rem] text-[#0a1722] mb-4">{state}</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {grouped[state].map((s) => (
                    <Link
                      key={`${s.suburbSlug}-${s.state}`}
                      href={`/tradies-in/${s.suburbSlug}-${s.state}`}
                      className="group flex items-center justify-between gap-3 bg-white border border-[#e5e9ec] rounded-xl px-4 py-3.5 hover:border-[#ffb400] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MapPin size={14} className="text-[#ffb400] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-[#0a1722] truncate">{s.suburb}</p>
                          <p className="text-[12px] text-[#8b96a1]">
                            {s.tradeCount} trade{s.tradeCount !== 1 ? "s" : ""} - {s.totalListings} listing{s.totalListings !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <ArrowRight size={14} className="text-[#c7ced3] group-hover:text-[#ffb400] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
