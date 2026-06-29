import Link from "next/link";
import { MapPin, Star, Phone, Globe, Mail, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

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
  id: string;
  business_name: string;
  trade: string | null;
  suburb: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  rating: number | null;
  review_count: number | null;
  photo_refs: string[] | null;
  place_id: string | null;
};

function StarRating({ rating }: { rating: number }) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star
          key={i}
          size={12}
          className={i <= full ? "fill-[#ffb400] text-[#ffb400]" : (i === full + 1 && half) ? "fill-[#ffb400]/50 text-[#ffb400]" : "text-[var(--line)]"}
        />
      ))}
    </span>
  );
}

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
    .order("rating", { ascending: false, nullsFirst: false })
    .order("review_count", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (trade)  query = query.eq("trade", trade);
  if (suburb) query = query.ilike("suburb", `%${suburb}%`);

  const { data: listings, error, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / perPage);

  return (
    <main className="min-h-screen" style={{ background: "var(--app-bg)" }}>
      {/* Hero */}
      <div style={{ background: "var(--navy)" }} className="text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="font-display text-[20px] text-[var(--amber)]">Swiftscope</Link>
            <div className="flex gap-4">
              <Link href="/login" className="text-white/70 hover:text-white text-[13px] font-semibold">Log in</Link>
              <Link href="/signup" className="bg-[var(--amber)] text-[var(--navy)] text-[13px] font-bold px-4 py-2 rounded-lg hover:opacity-90">
                Free trial
              </Link>
            </div>
          </div>
          <h1 className="font-display text-[2.6rem] leading-tight mb-2">
            Find a trusted local tradie
          </h1>
          <p className="text-[var(--steel-2)] text-[15px] max-w-xl">
            {count ?? 0} verified businesses across Melbourne&apos;s south east.
            Real ratings from Google Reviews.
          </p>
        </div>
      </div>

      {/* Sticky search */}
      <div className="sticky top-0 z-20 bg-white border-b border-[var(--line)] shadow-sm">
        <form method="GET" className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap gap-2 items-center">
          <select name="trade" defaultValue={trade ?? ""}
            className="app-field text-[13px] w-auto">
            <option value="">All trades</option>
            {ALL_TRADES.map(t => <option key={t} value={t}>{TRADE_LABELS[t] ?? t}</option>)}
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

        {/* Trade filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link href={`/directory${suburb ? `?suburb=${suburb}` : ""}`}
            className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${!trade ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "border-[var(--line)] text-[var(--ink-faint)] hover:border-[var(--navy)] hover:text-[var(--navy)]"}`}>
            All
          </Link>
          {ALL_TRADES.map(t => (
            <Link key={t}
              href={`/directory?trade=${t}${suburb ? `&suburb=${suburb}` : ""}`}
              className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${trade === t ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "border-[var(--line)] text-[var(--ink-faint)] hover:border-[var(--navy)] hover:text-[var(--navy)]"}`}>
              {TRADE_LABELS[t]}
            </Link>
          ))}
        </div>

        {/* Grid */}
        {listings?.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-[32px] mb-3">🔍</p>
            <p className="font-semibold text-[var(--ink)] mb-1">No tradies found</p>
            <p className="text-[13.5px] text-[var(--ink-faint)] mb-5">
              Try a different trade or suburb.
            </p>
            <Link href="/directory" className="btn-secondary inline-flex">Clear filters</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings?.map((listing: Listing) => (
              <div key={listing.id} className="card flex flex-col overflow-hidden p-0">
                {/* Photo */}
                {listing.photo_refs?.[0] ? (
                  <div className="h-40 bg-[var(--app-bg)] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/places/photo?ref=${listing.photo_refs[0]}&maxw=600`}
                      alt={listing.business_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="h-32 bg-gradient-to-br from-[var(--amber-light)] to-[var(--app-bg)] flex items-center justify-center">
                    <span className="font-display text-[3rem] text-[var(--amber-deep)] opacity-30">
                      {listing.business_name.charAt(0)}
                    </span>
                  </div>
                )}

                <div className="p-4 flex flex-col flex-1">
                  {/* Trade badge */}
                  {listing.trade && (
                    <span className="inline-block text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--amber-light)] text-[var(--amber-deep)] mb-2 w-fit capitalize">
                      {TRADE_LABELS[listing.trade] ?? listing.trade}
                    </span>
                  )}

                  {/* Name */}
                  <h2 className="font-bold text-[15px] text-[var(--ink)] leading-snug mb-1">
                    {listing.business_name}
                  </h2>

                  {/* Location */}
                  {listing.suburb && (
                    <p className="text-[12px] text-[var(--ink-faint)] flex items-center gap-1 mb-2">
                      <MapPin size={11} /> {listing.suburb}
                    </p>
                  )}

                  {/* Rating */}
                  {listing.rating && (
                    <div className="flex items-center gap-1.5 mb-3">
                      <StarRating rating={listing.rating} />
                      <span className="text-[12.5px] font-bold text-[var(--ink)]">{listing.rating.toFixed(1)}</span>
                      {listing.review_count && (
                        <span className="text-[12px] text-[var(--ink-faint)]">({listing.review_count.toLocaleString()})</span>
                      )}
                    </div>
                  )}

                  {/* Contact */}
                  <div className="mt-auto pt-3 border-t border-[var(--line-subtle)] flex flex-wrap gap-2 items-center">
                    {listing.phone && (
                      <a href={`tel:${listing.phone}`}
                        className="flex items-center gap-1 text-[12px] font-semibold text-[var(--navy)] hover:opacity-70">
                        <Phone size={12} /> {listing.phone}
                      </a>
                    )}
                    <div className="flex gap-2 ml-auto">
                      {listing.email && (
                        <a href={`mailto:${listing.email}`}
                          className="flex items-center gap-1 text-[12px] text-[var(--blue)] hover:opacity-70 font-semibold">
                          <Mail size={12} /> Email
                        </a>
                      )}
                      {listing.website && (
                        <a href={listing.website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[12px] text-[var(--blue)] hover:opacity-70 font-semibold">
                          <Globe size={12} /> Website
                        </a>
                      )}
                      {listing.place_id && (
                        <a href={`https://maps.google.com/?place_id=${listing.place_id}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[12px] text-[var(--ink-faint)] hover:opacity-70 font-semibold">
                          Maps
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            {page > 1 && (
              <Link href={`/directory?${new URLSearchParams({ ...(trade ? { trade } : {}), ...(suburb ? { suburb } : {}), page: String(page - 1) })}`}
                className="btn-secondary text-[13px] py-2">
                ← Previous
              </Link>
            )}
            <span className="text-[13px] text-[var(--ink-faint)] px-4">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link href={`/directory?${new URLSearchParams({ ...(trade ? { trade } : {}), ...(suburb ? { suburb } : {}), page: String(page + 1) })}`}
                className="btn-secondary text-[13px] py-2">
                Next →
              </Link>
            )}
          </div>
        )}

        {/* Tradie CTA */}
        <div className="mt-14 rounded-2xl p-8 text-center" style={{ background: "var(--navy)" }}>
          <p className="font-display text-[1.8rem] text-white mb-2">Are you a tradie?</p>
          <p className="text-[var(--steel-2)] text-[14px] mb-5 max-w-md mx-auto">
            Get listed for free. Reach homeowners searching for your trade in your area.
            Takes 2 minutes.
          </p>
          <Link href="/signup" className="btn-primary inline-flex text-[15px]">
            Start your free trial →
          </Link>
        </div>
      </div>
    </main>
  );
}
