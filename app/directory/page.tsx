import Link from "next/link";
import { Search, Shield, Star, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import DirectoryCard from "@/components/DirectoryCard";

const ALL_TRADES = [
  "electrician","plumber","builder","roofer","painter","carpenter",
  "tiler","landscaper","concreter","fencer","plasterer","handyman",
];

const TRADE_LABELS: Record<string,string> = {
  electrician:"Electrician", plumber:"Plumber", builder:"Builder",
  roofer:"Roofer", painter:"Painter", carpenter:"Carpenter",
  tiler:"Tiler", landscaper:"Landscaper", concreter:"Concreter",
  fencer:"Fencer", plasterer:"Plasterer", handyman:"Handyman",
};

type Listing = {
  id: string; business_name: string; trades: string[] | null;
  suburb: string | null; scraped_contact_phone: string | null;
  website_url: string | null; scraped_contact_email: string | null;
  google_rating: number | null; google_reviews_count: number | null;
  photo_references: string[] | null; place_id: string | null;
  blurb: string | null; logo_url: string | null;
};

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ trade?: string; suburb?: string; page?: string }>;
}) {
  const { trade, suburb, page: pageParam } = await searchParams;
  const page    = parseInt(pageParam ?? "1");
  const perPage = 24;
  const from    = (page - 1) * perPage;
  const to      = from + perPage - 1;

  const supabase = await createClient();

  let query = supabase
    .from("directory_listing")
    .select("*", { count: "exact" })
    .order("google_rating", { ascending: false, nullsFirst: false })
    .order("google_reviews_count", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (trade)  query = query.contains("trades", [trade]);
  if (suburb) query = query.ilike("suburb", `%${suburb}%`);

  const { data: listings, error, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / perPage);

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-[#0a1722] text-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="font-display text-[20px] text-[#ffb400]">Swiftscope</Link>
          <div className="flex items-center gap-5">
            <Link href="/directory" className="text-white/70 hover:text-white text-[13px] font-semibold">Directory</Link>
            <Link href="/login" className="text-white/70 hover:text-white text-[13px] font-semibold">Log in</Link>
            <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] text-[13px] font-bold px-4 py-2 rounded-lg hover:opacity-90">
              Free trial
            </Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Swiftscope Directory</p>
            <h1 className="font-display text-[3rem] leading-tight text-gray-900 mb-4">
              Find a trusted local tradie
            </h1>
            <p className="text-[16px] text-gray-500 mb-8">
              {count ?? 0} verified businesses across Melbourne&apos;s south east.
              Every rating is from real Google Reviews.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-4 mb-10">
              {[
                { icon: Shield, text: "Verified businesses" },
                { icon: Star,   text: "Real Google ratings" },
                { icon: Users,  text: "196 local tradies" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-[13px] font-semibold text-gray-600">
                  <Icon size={15} className="text-[#ffb400]" /> {text}
                </div>
              ))}
            </div>

            {/* Two paths */}
            <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
              <Link href="/get-quotes"
                className="flex flex-col bg-[#0a1722] rounded-2xl p-5 hover:opacity-90 transition-opacity">
                <p className="font-bold text-[16px] text-white mb-1">Get quotes</p>
                <p className="text-[13px] text-white/60 mb-4 leading-snug">
                  Tell us what you need. Up to 3 local tradies will contact you.
                </p>
                <p className="text-[#ffb400] font-bold text-[13px] mt-auto">Start request →</p>
              </Link>
              <Link href="#listings"
                className="flex flex-col bg-gray-50 border border-gray-200 rounded-2xl p-5 hover:bg-gray-100 transition-colors">
                <p className="font-bold text-[16px] text-gray-900 mb-1">Browse directory</p>
                <p className="text-[13px] text-gray-500 mb-4 leading-snug">
                  Search and compare {count ?? 0} local businesses by trade and suburb.
                </p>
                <p className="text-gray-700 font-bold text-[13px] mt-auto">Browse tradies →</p>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky search */}
      <div id="listings" className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <form method="GET" className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap gap-2 items-center">
          <select name="trade" defaultValue={trade ?? ""}
            className="app-field text-[13px] w-auto bg-white">
            <option value="">All trades</option>
            {ALL_TRADES.map(t => <option key={t} value={t}>{TRADE_LABELS[t]}</option>)}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" name="suburb" defaultValue={suburb ?? ""}
              placeholder="Suburb e.g. Seaford, Frankston..."
              className="app-field pl-8 text-[13px] w-full bg-white" />
          </div>
          <button type="submit"
            className="bg-[#0a1722] text-white font-bold text-[13px] px-5 py-2.5 rounded-xl hover:opacity-90">
            Search
          </button>
          {(trade || suburb) && (
            <Link href="/directory" className="text-[13px] text-gray-500 hover:text-gray-800">Clear</Link>
          )}
          <span className="text-[12px] text-gray-400 ml-auto hidden sm:block">
            {count ?? 0} result{count !== 1 ? "s" : ""}
            {trade ? ` · ${TRADE_LABELS[trade] ?? trade}` : ""}
            {suburb ? ` · ${suburb}` : ""}
          </span>
        </form>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 text-red-700 text-[13px] px-4 py-3 rounded-xl mb-6 font-semibold">
            Could not load directory: {error.message}
          </div>
        )}

        {/* Trade pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link href={`/directory${suburb ? `?suburb=${suburb}` : ""}`}
            className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${!trade ? "bg-[#0a1722] text-white border-[#0a1722]" : "border-gray-200 text-gray-600 hover:border-gray-400 bg-white"}`}>
            All trades
          </Link>
          {ALL_TRADES.map(t => (
            <Link key={t} href={`/directory?trade=${t}${suburb ? `&suburb=${suburb}` : ""}`}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${trade === t ? "bg-[#0a1722] text-white border-[#0a1722]" : "border-gray-200 text-gray-600 hover:border-gray-400 bg-white"}`}>
              {TRADE_LABELS[t]}
            </Link>
          ))}
        </div>

        {/* Grid */}
        {!listings?.length ? (
          <div className="bg-white rounded-2xl border border-gray-100 text-center py-16">
            <p className="text-[32px] mb-3">🔍</p>
            <p className="font-semibold text-gray-900 mb-1">No tradies found</p>
            <p className="text-[13.5px] text-gray-500 mb-5">Try a different trade or suburb.</p>
            <Link href="/directory" className="px-5 py-2.5 border border-gray-200 rounded-xl text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50 inline-flex">
              Clear filters
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing: Listing, i: number) => (
              <DirectoryCard key={listing.id} listing={listing} index={i} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            {page > 1 && (
              <Link href={`/directory?${new URLSearchParams({ ...(trade?{trade}:{}), ...(suburb?{suburb}:{}), page: String(page-1) })}`}
                className="px-4 py-2 border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-700 hover:bg-gray-50 bg-white">
                ← Previous
              </Link>
            )}
            <span className="text-[13px] text-gray-500 px-4">Page {page} of {totalPages}</span>
            {page < totalPages && (
              <Link href={`/directory?${new URLSearchParams({ ...(trade?{trade}:{}), ...(suburb?{suburb}:{}), page: String(page+1) })}`}
                className="px-4 py-2 border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-700 hover:bg-gray-50 bg-white">
                Next →
              </Link>
            )}
          </div>
        )}

        {/* Tradie CTA */}
        <div className="mt-14 bg-[#0a1722] rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-display text-[1.6rem] text-white mb-1">Are you a tradie?</p>
            <p className="text-white/60 text-[14px] max-w-sm">
              Get listed free and reach homeowners searching for your trade in your area.
            </p>
          </div>
          <Link href="/signup"
            className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-7 py-3.5 rounded-xl hover:opacity-90 whitespace-nowrap shrink-0">
            Start free trial →
          </Link>
        </div>
      </div>
    </main>
  );
}
