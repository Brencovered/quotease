import Link from "next/link";
import { Search } from "lucide-react";
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
  photo_references: string[] | null; place_id: string | null; blurb: string | null;
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
    <main className="min-h-screen" style={{ background: "var(--app-bg)" }}>
      {/* Hero */}
      <div style={{ background: "var(--navy)" }} className="text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="font-display text-[20px] text-[var(--amber)]">Swiftscope</Link>
            <div className="flex gap-4">
              <Link href="/login" className="text-white/70 hover:text-white text-[13px] font-semibold">Log in</Link>
              <Link href="/signup" className="bg-[var(--amber)] text-[var(--navy)] text-[13px] font-bold px-4 py-2 rounded-lg hover:opacity-90">
                Free trial
              </Link>
            </div>
          </div>
          <h1 className="font-display text-[2.6rem] leading-tight mb-2">Find a trusted local tradie</h1>
          <p className="text-[var(--steel-2)] text-[15px] max-w-xl">
            {count ?? 0} verified businesses across Melbourne&apos;s south east. Real ratings from Google Reviews.
          </p>
        </div>
      </div>

      {/* Sticky search */}
      <div className="sticky top-0 z-20 bg-white border-b border-[var(--line)] shadow-sm">
        <form method="GET" className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap gap-2 items-center">
          <select name="trade" defaultValue={trade ?? ""} className="app-field text-[13px] w-auto">
            <option value="">All trades</option>
            {ALL_TRADES.map(t => <option key={t} value={t}>{TRADE_LABELS[t]}</option>)}
          </select>
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
            <input type="text" name="suburb" defaultValue={suburb ?? ""}
              placeholder="Suburb e.g. Seaford, Frankston..."
              className="app-field pl-8 text-[13px] w-full" />
          </div>
          <button type="submit" className="btn-primary text-[13px] py-2">Search</button>
          {(trade || suburb) && (
            <Link href="/directory" className="text-[13px] text-[var(--ink-faint)] hover:text-[var(--ink)]">Clear</Link>
          )}
          <span className="text-[12px] text-[var(--ink-faint)] ml-auto hidden sm:block">
            {count ?? 0} result{count !== 1 ? "s" : ""}
            {trade ? ` · ${TRADE_LABELS[trade] ?? trade}` : ""}
            {suburb ? ` · ${suburb}` : ""}
          </span>
        </form>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="card bg-[var(--red-bg)] text-[var(--red)] text-[13px] mb-6">
            Could not load directory: {error.message}
          </div>
        )}

        {/* Trade pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link href={`/directory${suburb ? `?suburb=${suburb}` : ""}`}
            className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${!trade ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "border-[var(--line)] text-[var(--ink-faint)] hover:border-[var(--navy)] hover:text-[var(--navy)]"}`}>
            All
          </Link>
          {ALL_TRADES.map(t => (
            <Link key={t} href={`/directory?trade=${t}${suburb ? `&suburb=${suburb}` : ""}`}
              className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${trade === t ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "border-[var(--line)] text-[var(--ink-faint)] hover:border-[var(--navy)] hover:text-[var(--navy)]"}`}>
              {TRADE_LABELS[t]}
            </Link>
          ))}
        </div>

        {/* Cards */}
        {!listings?.length ? (
          <div className="card text-center py-16">
            <p className="text-[32px] mb-3">🔍</p>
            <p className="font-semibold text-[var(--ink)] mb-1">No tradies found</p>
            <p className="text-[13.5px] text-[var(--ink-faint)] mb-5">Try a different trade or suburb.</p>
            <Link href="/directory" className="btn-secondary inline-flex">Clear filters</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing: Listing) => (
              <DirectoryCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            {page > 1 && (
              <Link href={`/directory?${new URLSearchParams({ ...(trade?{trade}:{}), ...(suburb?{suburb}:{}), page: String(page-1) })}`}
                className="btn-secondary text-[13px] py-2">← Previous</Link>
            )}
            <span className="text-[13px] text-[var(--ink-faint)] px-4">Page {page} of {totalPages}</span>
            {page < totalPages && (
              <Link href={`/directory?${new URLSearchParams({ ...(trade?{trade}:{}), ...(suburb?{suburb}:{}), page: String(page+1) })}`}
                className="btn-secondary text-[13px] py-2">Next →</Link>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="mt-14 rounded-2xl p-8 text-center" style={{ background: "var(--navy)" }}>
          <p className="font-display text-[1.8rem] text-white mb-2">Are you a tradie?</p>
          <p className="text-[var(--steel-2)] text-[14px] mb-5 max-w-md mx-auto">
            Get listed for free. Reach homeowners searching for your trade in your area.
          </p>
          <Link href="/signup" className="btn-primary inline-flex text-[15px]">Start your free trial →</Link>
        </div>
      </div>
    </main>
  );
}
