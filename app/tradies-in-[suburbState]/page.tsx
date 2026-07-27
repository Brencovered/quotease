/**
 * app/tradies-in-[suburbState]/page.tsx
 * --------------------------------------
 * "Tradies in {Suburb}" - lists every trade with listings in a suburb,
 * one page per suburb rather than per trade x suburb combo.
 *
 * Why this exists: the site only had trade-specific landing pages
 * (/electricians-seaford-vic, /roofers-seaford-vic, etc - see
 * app/[tradeSuburb]/page.tsx). A broad search like "tradies in Seaford"
 * (no trade specified) had no dedicated page to match against - Google
 * had nothing better to show than the generic directory/homepage.
 *
 * URL shape mirrors the trade+suburb pages but drops the trade prefix:
 * "seaford-vic" instead of "electricians-seaford-vic" - a static
 * "tradies-in-" folder prefix keeps this route distinct from
 * app/[tradeSuburb]'s bare single dynamic segment (Next.js doesn't allow
 * two different dynamic param names at the same path level otherwise).
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Star, MapPin, ArrowRight, Shield } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSuburbSlug, suburbLandingCanonical, getTradeDisplay, tradeToSlug } from "@/lib/seo/meta";
import MarketingNav from "@/components/MarketingNav";
import { buildDirectorySlug } from "@/lib/seo/meta";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ suburbState: string }>;
}

const MIN_LISTINGS_FOR_INDEX = 3;

async function fetchTradeSuburbPages(admin: ReturnType<typeof createAdminClient>, suburbSlug: string, state: string) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { data, error } = await admin
      .from("trade_suburb_pages")
      .select("trade, suburb, listing_count, avg_rating, total_reviews, is_indexed")
      .eq("suburb_slug", suburbSlug)
      .eq("state", state)
      .order("listing_count", { ascending: false });

    if (!error) return { data, error: null };
    if (attempt === 1) {
      console.warn(`[tradies-in] trade_suburb_pages query failed for ${suburbSlug}-${state}, retrying once:`, error.message);
      await new Promise((r) => setTimeout(r, 200));
    } else {
      return { data: null, error };
    }
  }
  return { data: null, error: null }; // unreachable, satisfies TS
}

async function loadSuburbContent(suburbSlug: string, state: string) {
  const admin = createAdminClient();

  const { data: trades, error: tradesErr } = await fetchTradeSuburbPages(admin, suburbSlug, state);
  console.error(`[tradies-in] DIAG: query for suburbSlug="${suburbSlug}" state="${state}" -> error=${tradesErr ? tradesErr.message : "null"}, rowCount=${trades ? trades.length : "null"}`);

  // A genuine query failure (timeout, transient network blip, connection
  // pressure -- more likely now that this route is force-dynamic and every
  // request hits the database fresh) must NOT be treated the same as "this
  // suburb genuinely has no data". Confirmed exactly this symptom: the
  // identical URL flip-flopped between 200 and 404 within seconds on the
  // same deployment -- that's a transient query failure being silently
  // read as "not found", not a real content gap. Throwing here lets
  // Next.js's error boundary handle it (and Vercel retry/log it properly)
  // instead of permanently telling users and Google the page doesn't exist.
  if (tradesErr) {
    throw new Error(`[tradies-in] trade_suburb_pages query failed for ${suburbSlug}-${state}: ${tradesErr.message}`);
  }

  if (!trades || trades.length === 0) return null;

  const suburb = trades[0].suburb;
  const totalListings = trades.reduce((sum, t) => sum + (t.listing_count ?? 0), 0);
  const totalReviews = trades.reduce((sum, t) => sum + (t.total_reviews ?? 0), 0);
  const ratedTrades = trades.filter((t) => t.avg_rating != null);
  const avgRating = ratedTrades.length > 0
    ? ratedTrades.reduce((sum, t) => sum + Number(t.avg_rating), 0) / ratedTrades.length
    : null;

  const { data: topListings, error: listingsErr } = await admin
    .from("directory_listing")
    .select("id, business_name, suburb, trades, google_rating, google_reviews_count")
    .eq("suburb", suburb)
    .not("google_rating", "is", null)
    .order("google_rating", { ascending: false })
    .order("google_reviews_count", { ascending: false })
    .limit(6);

  if (listingsErr) {
    // Non-fatal -- the page is still meaningful without the "top rated"
    // section, so degrade gracefully here rather than fail the whole page.
    console.error(`[tradies-in] directory_listing top-listings query failed for ${suburb}:`, listingsErr.message);
  }

  return { suburb, state, trades, totalListings, totalReviews, avgRating, topListings: topListings ?? [] };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { suburbState } = await params;
  const parsed = parseSuburbSlug(suburbState);
  if (!parsed) return {};

  const content = await loadSuburbContent(parsed.suburbSlug, parsed.state);
  if (!content) return {};

  const canonical = suburbLandingCanonical(parsed.suburbSlug, parsed.state);
  const tradeNames = content.trades.map((t) => getTradeDisplay(t.trade).plural.toLowerCase()).join(", ");
  const title = `Tradies in ${content.suburb} | ${content.totalListings} Local Trades - Swiftscope`;
  const description = `Find local tradies in ${content.suburb}: ${tradeNames}. ${content.totalListings} curated listings with real Google reviews on Swiftscope.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: "Swiftscope", type: "website" },
    twitter: { card: "summary", title, description },
    // Same thin-content protection as the trade+suburb pages
    // (tradeSuburbMeta in this file) - don't ask Google to index a
    // suburb page that doesn't have enough combined listings across all
    // trades to be worth ranking. MIN_LISTINGS_FOR_INDEX is duplicated
    // here rather than imported since it lives in the page component,
    // not this lib file.
    robots: { index: content.totalListings >= MIN_LISTINGS_FOR_INDEX, follow: true },
  };
}

export default async function SuburbLandingPage({ params }: PageProps) {
  const { suburbState } = await params;
  const parsed = parseSuburbSlug(suburbState);
  if (!parsed) {
    console.error(`[tradies-in] DIAG: parseSuburbSlug returned null for raw param "${suburbState}"`);
    notFound();
  }

  const content = await loadSuburbContent(parsed.suburbSlug, parsed.state);
  if (!content) {
    console.error(`[tradies-in] DIAG: loadSuburbContent returned null for suburbSlug="${parsed.suburbSlug}" state="${parsed.state}" (parsed from raw param "${suburbState}")`);
    notFound();
  }

  const { suburb, state, trades, totalListings, totalReviews, avgRating, topListings } = content;

  return (
    <main className="bg-white text-[#0a1722]">
      <MarketingNav />

      {/* HERO */}
      <div className="bg-[#0a1722] border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 pt-12 pb-16">
          <nav className="text-[12px] text-white/40 mb-4 flex items-center gap-1.5 flex-wrap">
            <Link href="/" className="hover:text-white">Home</Link>
            <span>/</span>
            <Link href="/directory" className="hover:text-white">Directory</Link>
            <span>/</span>
            <span className="text-white/70">Tradies in {suburb}</span>
          </nav>
          <h1 className="font-display uppercase text-[2.4rem] sm:text-[3.2rem] leading-[0.95] text-white max-w-2xl mb-4">
            Tradies in {suburb}, {state.toUpperCase()}
          </h1>
          <p className="text-[16px] text-[#8aa4b4] max-w-xl mb-6">
            {totalListings} curated local tradies across {trades.length} trade{trades.length !== 1 ? "s" : ""} in {suburb}
            {avgRating ? ` - average rating ${avgRating.toFixed(1)} stars` : ""}. Real Google reviews, no fake listings.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/directory?suburb=${encodeURIComponent(suburb)}`} className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-7 py-3.5 rounded-xl hover:opacity-90">
              Browse all {totalListings} listings <ArrowRight size={15} />
            </Link>
          </div>
          {totalReviews > 0 && (
            <div className="flex items-center gap-4 mt-7 text-[13px] font-semibold text-[#8aa4b4]">
              <span className="flex items-center gap-1.5"><Shield size={14} className="text-[#ffb400]" /> Verified Google ratings</span>
              <span className="flex items-center gap-1.5"><Star size={14} className="text-[#ffb400]" /> {totalReviews.toLocaleString()} total reviews</span>
              <span className="flex items-center gap-1.5"><MapPin size={14} className="text-[#ffb400]" /> {suburb}, {state.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>

      {/* TRADES IN THIS SUBURB */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="font-display uppercase text-[1.8rem] sm:text-[2.2rem] text-[#0a1722] mb-8">
            Trades available in {suburb}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {trades.map((t) => {
              const { singular, plural } = getTradeDisplay(t.trade);
              return (
                <Link
                  key={t.trade}
                  href={`/${tradeToSlug(t.trade)}-${parsed.suburbSlug}-${parsed.state}`}
                  className="flex items-center justify-between gap-4 bg-[#f8f9fa] border border-[#e8ecef] rounded-2xl p-5 hover:border-[#ffb400]/50 transition-colors"
                >
                  <div>
                    <p className="font-bold text-[15px] text-[#0a1722]">{plural} in {suburb}</p>
                    <p className="text-[12.5px] text-[#5a6b76] mt-0.5">
                      {t.listing_count} listing{t.listing_count !== 1 ? "s" : ""}
                      {t.avg_rating != null ? ` - ${Number(t.avg_rating).toFixed(1)}★ avg` : ""}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-[#8aa4b4] shrink-0" aria-label={`View ${singular.toLowerCase()}s`} />
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* TOP LISTINGS ACROSS ALL TRADES */}
      {topListings.length > 0 && (
        <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <h2 className="font-display uppercase text-[1.8rem] sm:text-[2.2rem] text-[#0a1722] mb-8">
              Top rated tradies in {suburb}
            </h2>
            <div className="space-y-3">
              {topListings.map((l, i) => (
                <Link
                  key={l.id}
                  href={`/directory/${buildDirectorySlug(l)}`}
                  className="flex items-center gap-4 bg-white border border-[#e8ecef] rounded-2xl p-5 hover:border-[#ffb400]/50 transition-colors"
                >
                  <span className="font-display text-[1.6rem] text-[#d6dde1] w-8 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[15px] text-[#0a1722] truncate">{l.business_name}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {l.google_rating != null && (
                        <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[#0a1722]">
                          <Star size={12} className="fill-[#ffb400] text-[#ffb400]" /> {l.google_rating.toFixed(1)}
                          {l.google_reviews_count ? ` (${l.google_reviews_count})` : ""}
                        </span>
                      )}
                      {(l.trades ?? []).slice(0, 2).map((tr: string) => (
                        <span key={tr} className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#eef1f3] text-[#5a6b76] capitalize">{tr}</span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-[#8aa4b4] shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
