import Link from "next/link";
import { Globe, MapPin, BadgeCheck, Phone, Mail, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";

const ALL_TRADES = [
  "electrician","plumber","carpenter","roofer","painter","tiler",
  "landscaper","arborist","concreter","fencer","aircon","surveyor",
];

const TRADE_LABELS: Record<string,string> = {
  electrician:"Electrician", plumber:"Plumber", carpenter:"Carpenter",
  roofer:"Roofer", painter:"Painter", tiler:"Tiler", landscaper:"Landscaper",
  arborist:"Arborist", concreter:"Concreter", fencer:"Fencer",
  aircon:"Air conditioning", surveyor:"Surveyor",
};

type Listing = {
  id: string; business_name: string; trades: string[];
  suburb: string | null; postcode: string | null; bio: string | null;
  website_url: string | null; phone: string | null; email: string | null;
  logo_url: string | null; is_claimed: boolean;
};

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ trade?: string; suburb?: string }>;
}) {
  const { trade, suburb } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("directory_public")
    .select("*")
    .order("business_name", { ascending: true });

  if (trade)  query = query.contains("trades", [trade]);
  if (suburb) query = query.ilike("suburb", `%${suburb}%`);

  const { data: listings, error } = await query;

  return (
    <main className="min-h-screen bg-[var(--app-bg)]">
      {/* Hero */}
      <div className="bg-[var(--navy)] text-white">
        <div className="max-w-5xl mx-auto px-6 py-14">
          <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[var(--amber)] mb-3">
            Swiftscope Directory
          </p>
          <h1 className="font-display text-[2.8rem] leading-tight mb-3">
            Find a trusted local tradie
          </h1>
          <p className="text-[var(--steel-2)] text-[16px] max-w-xl">
            Every tradie here runs their business on Swiftscope — they quote fast, communicate clearly, and get the job done.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-[var(--line)] bg-white sticky top-0 z-10">
        <form method="GET" className="max-w-5xl mx-auto px-6 py-3 flex flex-wrap gap-2 items-center">
          <div className="relative">
            <select
              name="trade"
              defaultValue={trade ?? ""}
              className="app-field text-[13px] pr-8"
            >
              <option value="">All trades</option>
              {ALL_TRADES.map(t => (
                <option key={t} value={t}>{TRADE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
            <input
              type="text"
              name="suburb"
              placeholder="Suburb or postcode..."
              defaultValue={suburb ?? ""}
              className="app-field pl-8 text-[13px] w-full"
            />
          </div>
          <button type="submit" className="btn-primary text-[13px] py-2">
            Search
          </button>
          {(trade || suburb) && (
            <Link href="/directory" className="text-[13px] text-[var(--ink-faint)] hover:text-[var(--ink)]">
              Clear
            </Link>
          )}
          <span className="text-[12px] text-[var(--ink-faint)] ml-auto">
            {listings?.length ?? 0} tradie{listings?.length !== 1 ? "s" : ""}
            {trade ? ` · ${TRADE_LABELS[trade] ?? trade}` : ""}
            {suburb ? ` · ${suburb}` : ""}
          </span>
        </form>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="card bg-[var(--red-bg)] text-[var(--red)] text-[13px] mb-6">
            Could not load directory: {error.message}
          </div>
        )}

        {!error && listings?.length === 0 && (
          <div className="card text-center py-16">
            <p className="text-[32px] mb-3">🔍</p>
            <p className="font-semibold text-[var(--ink)] mb-1">No tradies found</p>
            <p className="text-[13.5px] text-[var(--ink-faint)] mb-5">
              {trade || suburb ? "Try a different trade or suburb." : "No tradies have joined the directory yet."}
            </p>
            <Link href="/directory" className="btn-secondary inline-flex">Clear search</Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings?.map((listing: Listing) => (
            <div key={listing.id} className="card flex flex-col">
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                {listing.logo_url ? (
                  <img src={listing.logo_url} alt={listing.business_name}
                    className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[var(--line)]" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[var(--amber-light)] flex items-center justify-center shrink-0 text-[var(--amber-deep)] font-display text-[20px]">
                    {listing.business_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="font-bold text-[15px] text-[var(--ink)] truncate">
                      {listing.business_name}
                    </h2>
                    {listing.is_claimed && (
                      <span className="flex items-center gap-0.5 text-[10.5px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--green-bg)] text-[var(--green)] shrink-0">
                        <BadgeCheck size={10} /> Verified
                      </span>
                    )}
                  </div>
                  {listing.suburb && (
                    <p className="text-[12px] text-[var(--ink-faint)] flex items-center gap-1 mt-0.5">
                      <MapPin size={11} /> {listing.suburb}{listing.postcode ? ` ${listing.postcode}` : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* Trades */}
              <div className="flex flex-wrap gap-1 mb-3">
                {listing.trades?.map(t => (
                  <span key={t} className="text-[11px] px-2 py-0.5 rounded-full capitalize font-semibold bg-[var(--amber-light)] text-[var(--amber-deep)]">
                    {TRADE_LABELS[t] ?? t}
                  </span>
                ))}
              </div>

              {/* Bio */}
              {listing.bio && (
                <p className="text-[12.5px] text-[var(--ink-soft)] leading-snug mb-3 flex-1 line-clamp-3">
                  {listing.bio}
                </p>
              )}

              {/* Contact */}
              <div className="mt-auto pt-3 border-t border-[var(--line-subtle)] flex flex-wrap gap-2">
                {listing.phone && (
                  <a href={`tel:${listing.phone}`}
                    className="flex items-center gap-1 text-[12px] font-semibold text-[var(--navy)] hover:opacity-70">
                    <Phone size={12} /> {listing.phone}
                  </a>
                )}
                {listing.email && (
                  <a href={`mailto:${listing.email}`}
                    className="flex items-center gap-1 text-[12px] font-semibold text-[var(--navy)] hover:opacity-70">
                    <Mail size={12} /> Email
                  </a>
                )}
                {listing.website_url && (
                  <a href={listing.website_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[12px] font-semibold text-[var(--blue)] hover:opacity-70 ml-auto">
                    <Globe size={12} /> Website
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTA for tradies */}
        <div className="mt-12 card bg-[var(--navy)] text-center py-10">
          <p className="font-display text-[1.6rem] text-white mb-2">Are you a tradie?</p>
          <p className="text-[var(--steel-2)] text-[14px] mb-5 max-w-md mx-auto">
            Join the directory for free. Get your business in front of homeowners searching for your trade in your suburb.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="btn-primary">Start free trial</Link>
            <Link href="/login" className="btn-secondary text-white border-white/20">
              Already a member? Log in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
