/**
 * app/areas/page.tsx
 * -------------------
 * "Areas we cover" -- the top of the hub-and-spoke SEO structure:
 * /areas (this page) -> /tradies-in-{suburb}-{state} -> /{trade}-{suburb}-{state}
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

async function loadAreas(): Promise<Record<string, SuburbGroup[]>> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("trade_suburb_pages")
    .select("suburb, suburb_slug, state, listing_count")
    .eq("is_indexed", true);

  const bySuburb = new Map<string, SuburbGroup>();
  for (const row of rows ?? []) {
    const key = `${row.suburb_slug}-${row.state}`;
    const existing = bySuburb.get(key);
    if (existing) {
      existing.tradeCount += 1;
      existing.totalListings += row.listing_count ?? 0;
    } else {
      bySuburb.set(key, {
        suburb: row.suburb,
        suburbSlug: row.suburb_slug,
        state: row.state,
        tradeCount: 1,
        totalListings: row.listing_count ?? 0,
      });
    }
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
                      href={`/tradies-in-${s.suburbSlug}-${s.state}`}
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
