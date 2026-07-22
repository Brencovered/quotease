import Link from "next/link";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import {
  Search,
  Shield,
  Star,
  Lock,
  Check,
  ClipboardList,
  ArrowRight,
  Sparkles,
  Phone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DirectoryCard from "@/components/DirectoryCard";
import { directoryMeta } from "@/lib/seo/meta";
import MarketingNav from "@/components/MarketingNav";
import AnimatedCounter from "./_components/AnimatedCounter";
import DirectorySearchForm from "./_components/DirectorySearchForm";
import FindTradieHeroSearch from "./_components/FindTradieHeroSearch";
import { CLAIMED_DIRECTORY_PAGES_ENABLED } from "@/lib/featureFlags";

// Sitewide hero counters (total listings, suburbs covered) don't depend on
// searchParams at all - every visitor to /directory sees the same two
// numbers regardless of what they're searching for. Before this, they were
// re-fetched (a full count query + a full-table suburb scan) on literally
// every request, blocking the very first byte of the response before the
// hero could render. Cached for 10 minutes instead - these numbers only
// need to be "roughly current", not live-to-the-second.
const getDirectoryHeroStats = unstable_cache(
  async () => {
    try {
      const admin = createAdminClient();
      const [totalListingsRes, suburbRowsRes] = await Promise.all([
        admin.from("directory_listing").select("*", { count: "exact", head: true }),
        admin.from("directory_listing").select("suburb"),
      ]);
      const totalListings = totalListingsRes.count ?? 0;
      const suburbsCovered = new Set(
        (suburbRowsRes.data ?? []).map((r) => r.suburb?.trim().toLowerCase()).filter(Boolean)
      ).size;
      return { totalListings, suburbsCovered };
    } catch (err) {
      // This is decorative hero copy, not the source of truth for listing
      // data -- a transient env/config issue during background revalidation
      // (e.g. a missing key on a fresh preview deployment) should degrade
      // to 0s here, not take down the entire /directory page for every
      // visitor until the next successful revalidation.
      console.error("[directory] hero stats fetch failed:", err);
      return { totalListings: 0, suburbsCovered: 0 };
    }
  },
  ["directory-hero-stats"],
  { revalidate: 600 }
);

const ALL_TRADES = [
  "electrician",
  "plumber",
  "builder",
  "roofer",
  "painter",
  "carpenter",
  "tiler",
  "landscaper",
  "concreter",
  "fencer",
  "plasterer",
  "handyman",
];

const TRADE_LABELS: Record<string, string> = {
  electrician: "Electrician",
  plumber: "Plumber",
  builder: "Builder",
  roofer: "Roofer",
  painter: "Painter",
  carpenter: "Carpenter",
  tiler: "Tiler",
  landscaper: "Landscaper",
  concreter: "Concreter",
  fencer: "Fencer",
  plasterer: "Plasterer",
  handyman: "Handyman",
};

type Listing = {
  id: string;
  business_name: string;
  trades: string[] | null;
  suburb: string | null;
  scraped_contact_phone: string | null;
  website_url: string | null;
  scraped_contact_email: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  photo_references: string[] | null;
  place_id: string | null;
  blurb: string | null;
  logo_url: string | null;
};

/* ------------------------------------------------------------------ */
/*  Mock review data for the social-proof section                      */
/* ------------------------------------------------------------------ */
const HOMEOWNER_REVIEWS = [
  {
    name: "Sarah M.",
    suburb: "Frankston",
    trade: "Electrician",
    rating: 5,
    quote:
      "Posted my job on Monday, had 3 quotes by Tuesday afternoon. The electrician we hired was fantastic - punctual, professional and fairly priced.",
  },
  {
    name: "David K.",
    suburb: "Mount Eliza",
    trade: "Plumber",
    rating: 5,
    quote:
      "After a nightmare experience with a random Gumtree tradie, Swiftscope was a breath of fresh air. Every listing is hand-picked with real reviews.",
  },
  {
    name: "Jenny T.",
    suburb: "Mornington",
    trade: "Landscaper",
    rating: 5,
    quote:
      "We needed our backyard redone before Christmas. Got matched with an amazing landscaper who delivered ahead of schedule. Could not recommend more highly.",
  },
];

export const metadata: Metadata = directoryMeta();

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    trade?: string;
    postcode?: string;
    suburb?: string;
    search?: string;
    reviews?: string;
    rating?: string;
    sort?: string;
    page?: string;
    radius?: string;
  }>;
}) {
  const { trade, postcode: postcodeParam, suburb: suburbParam, search: searchParam, reviews, rating, sort, page: pageParam, radius } = await searchParams;
  const page = parseInt(pageParam ?? "1");
  const perPage = 24;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const supabase = await createClient();

  // Kicked off immediately, in parallel with everything else below - these
  // resolve from cache almost instantly except once every 10 minutes.
  const heroStatsPromise = getDirectoryHeroStats();

  // Trade filter
  const activeSort = sort ?? "rating";

  // Review count range filter (parsed once, used by both search paths)
  let minReviews: number | undefined;
  let maxReviews: number | undefined;
  if (reviews) {
    if (reviews === "500+") {
      minReviews = 500;
    } else if (reviews.includes("-")) {
      const [min, max] = reviews.split("-").map(Number);
      if (!isNaN(min)) minReviews = min;
      if (!isNaN(max)) maxReviews = max;
    }
  }
  const minRating = rating ? parseFloat(rating) : undefined;

  // Location filter - postcode is the primary, canonical search field
  // (the scraped suburb field is inconsistent: 482 distinct suburb
  // strings vs only 387 distinct postcodes across the same 2711 listings
  // - typos, "Mt" vs "Mount", etc). `suburb` is still accepted here only
  // because hundreds of programmatic SEO landing pages
  // (app/[tradeSuburb]) already link into this page with `?suburb=` -
  // it's resolved to postcode(s) the same way, never surfaced as its own
  // search field in the UI any more.
  const postcode = postcodeParam?.trim();
  const suburb = suburbParam?.trim();
  const search = searchParam?.trim();
  const radiusKm = radius ? parseFloat(radius) : NaN;
  // A name search isn't distance-based (you already know who you're
  // looking for) -- always use the plain query path below rather than the
  // radius RPC, which has no name parameter to extend.
  const hasRadius = !search && !isNaN(radiusKm) && radiusKm > 0;

  // Whether this load has any actual search applied - determines which of
  // the two very different page modes render below, but ALSO whether any
  // of the listings-search work is needed at all. Computed here (rather
  // than after the query work, as before) so it can guard that work: the
  // plain "/directory" landing page - the large majority of traffic, since
  // hundreds of SEO pages link with filters but organic/ad traffic lands
  // here bare - has no reason to run a full listings query at all.
  const hasActiveFilters = !!(trade || postcode || suburb || search || reviews || rating);

  // Resolve the search term to one or more postcodes, and (if a radius is
  // set) a centre point to measure distance from.
  let resolvedPostcodes: string[] = [];
  if (hasActiveFilters) {
    if (postcode) {
      resolvedPostcodes = [postcode];
    } else if (suburb) {
      if (/^\d+$/.test(suburb)) {
        resolvedPostcodes = [suburb];
      } else {
        const { data: postcodeRows } = await supabase
          .from("directory_listing")
          .select("postcode")
          .ilike("suburb", `%${suburb}%`)
          .not("postcode", "is", null);
        resolvedPostcodes = Array.from(new Set((postcodeRows ?? []).map((r) => r.postcode).filter((p): p is string => !!p)));
      }
    }
  }

  let listings: Listing[] | null = null;
  let error: { message: string } | null = null;
  let count = 0;

  if (hasActiveFilters && hasRadius && resolvedPostcodes.length > 0) {
    // Real distance-based search: find the centre point for the searched
    // postcode(s) (averaging if a suburb name resolved to more than one),
    // then delegate trade/rating/review/sort/pagination filtering to a
    // single combined RPC. Doing the radius filter client-side (fetch
    // matching ids, then `.in("id", ids)`) blows past request URL length
    // limits the moment a wide radius matches hundreds of listings (e.g.
    // 830 matches at 25km around a Melbourne postcode) - that surfaced as
    // "Bad Request". The RPC runs entirely server-side over POST instead.
    const centroids = await Promise.all(
      resolvedPostcodes.map((pc) => supabase.rpc("directory_postcode_centroid", { p_postcode: pc }))
    );
    const points = centroids
      .map((c) => c.data?.[0])
      .filter((p): p is { lat: number; lng: number } => !!p && p.lat != null && p.lng != null);

    if (points.length > 0) {
      const centerLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
      const centerLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
      const rpcArgs = {
        center_lat: centerLat, center_lng: centerLng, radius_km: radiusKm,
        p_trade: trade ?? null,
        p_min_rating: minRating ?? null,
        p_min_reviews: minReviews ?? null,
        p_max_reviews: maxReviews ?? null,
      };
      const [listRes, countRes] = await Promise.all([
        supabase.rpc("directory_search_nearby", { ...rpcArgs, p_sort: activeSort, p_limit: perPage, p_offset: from }),
        supabase.rpc("directory_search_nearby_count", rpcArgs),
      ]);
      listings = (listRes.data as Listing[] | null) ?? [];
      error = listRes.error ?? countRes.error ?? null;
      count = (countRes.data as number | null) ?? 0;
    } else {
      // Couldn't resolve a centre point at all (unknown postcode/suburb) -
      // fall through to a plain postcode match below so search doesn't
      // silently return every listing.
    }
  }

  if (hasActiveFilters && listings === null) {
    // Normal (non-radius, or unresolvable-location) search path.
    let query = supabase
      .from("directory_listing")
      .select("*", { count: "exact" });

    if (trade) query = query.contains("trades", [trade]);

    if (search) query = query.ilike("business_name", `%${search}%`);

    if (postcode) {
      query = query.ilike("postcode", `${postcode}%`);
    } else if (resolvedPostcodes.length > 0) {
      query = query.in("postcode", resolvedPostcodes);
    } else if (suburb) {
      // Couldn't resolve any postcode for this suburb text at all (typo,
      // or not in our data) - fall back to the raw suburb match so
      // search doesn't silently return everything.
      query = query.ilike("suburb", `%${suburb}%`);
    }

    if (minReviews !== undefined) query = query.gte("google_reviews_count", minReviews);
    if (maxReviews !== undefined) query = query.lt("google_reviews_count", maxReviews);
    if (minRating !== undefined && !isNaN(minRating)) query = query.gte("google_rating", minRating);

    if (activeSort === "reviews") {
      query = query
        .order("google_reviews_count", { ascending: false, nullsFirst: false })
        .order("google_rating", { ascending: false, nullsFirst: false });
    } else if (activeSort === "name") {
      query = query.order("business_name", { ascending: true });
    } else {
      query = query
        .order("google_rating", { ascending: false, nullsFirst: false })
        .order("google_reviews_count", { ascending: false, nullsFirst: false });
    }

    query = query.range(from, to);

    const result = await query;
    listings = result.data as Listing[] | null;
    error = result.error;
    count = result.count ?? 0;
  }

  const totalPages = Math.ceil((count ?? 0) / perPage);

  // Helper to build URLs preserving other filters
  function buildUrl(params: Record<string, string | undefined>): string {
    const sp = new URLSearchParams();
    if (trade) sp.set("trade", trade);
    if (postcode) sp.set("postcode", postcode);
    if (suburb) sp.set("suburb", suburb);
    if (reviews) sp.set("reviews", reviews);
    if (rating) sp.set("rating", rating);
    if (sort) sp.set("sort", sort);
    if (radius) sp.set("radius", radius);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    return `/directory${qs ? `?${qs}` : ""}`;
  }

  // Resolved last, but kicked off first (see heroStatsPromise above) - by
  // this point the cached lookup has almost always already resolved
  // concurrently with the search query work above, so this await rarely
  // costs anything.
  const { totalListings, suburbsCovered } = await heroStatsPromise;

  // No search applied - the listings query above was skipped entirely, so
  // use the cached sitewide total for the hero's count display instead
  // (it was already only ever a rough, decorative figure here - see
  // FindTradieHeroSearch - never the precise result-set count).
  if (!hasActiveFilters) count = totalListings;

  return (
    <main className="min-h-screen" style={{ background: "var(--app-bg)" }}>
      <style>{`
        @keyframes orb-float-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }
        @keyframes orb-float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-25px, 20px) scale(0.95); }
          66% { transform: translate(20px, -15px) scale(1.05); }
        }
        @keyframes orb-float-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(15px, -25px) scale(1.08); }
        }
      `}</style>

      <MarketingNav transparent={false} />

      {/* ═══════════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#0a1722]">
        <div
          className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(255,180,0,0.22) 0%, transparent 65%)",
            top: "-15%", left: "-8%",
            animation: "orb-float-1 10s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(37,99,235,0.14) 0%, transparent 65%)",
            top: "10%", right: "-10%",
            animation: "orb-float-2 12s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(255,180,0,0.10) 0%, transparent 60%)",
            bottom: "-10%", left: "35%",
            animation: "orb-float-3 9s ease-in-out infinite",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 sm:pt-20 sm:pb-24">
          <div className="reveal flex items-center gap-2 mb-5">
            <Sparkles size={14} className="text-[#ffb400]" />
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">
              Swiftscope Directory
            </span>
          </div>

          <h1 className="font-display text-[2.8rem] sm:text-[3.6rem] lg:text-[4.2rem] text-white leading-[1.05] mb-5">
            Find a trusted local tradie
          </h1>

          <p className="reveal text-[15px] sm:text-[16px] max-w-xl mb-10 leading-relaxed text-[#8b96a1]">
            A curated directory of local tradies with real Google reviews. Browse listings across Australia, or post your job and get up to 3 quotes.
          </p>

          <div
            className="reveal grid grid-cols-3 gap-6 sm:gap-10 max-w-lg mb-10 p-5 sm:p-6 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <AnimatedCounter target={totalListings} suffix="+" label="Curated listings" />
            <AnimatedCounter target={suburbsCovered} suffix="+" label="Suburbs covered" delay={150} />
            {/* Not an exact live count (real directory-specific quote-request
                volume is still low while the directory grows) - shown as a
                qualitative "100s+" rather than animating up to either a
                fake precise number or a discouragingly small real one. */}
            <div className="text-center">
              <div className="font-display text-[2.5rem] sm:text-[3rem] text-white leading-none tracking-tight">
                100s<span className="text-[#ffb400]">+</span>
              </div>
              <p className="text-[13px] font-semibold text-[#8b96a1] mt-2 uppercase tracking-wider">
                Quotes sent
              </p>
            </div>
          </div>

          <div className="reveal flex flex-wrap gap-4 sm:gap-6 mb-12">
            {[
              { icon: Star, text: "Real Google ratings" },
              { icon: Shield, text: "Curated listings" },
              { icon: Lock, text: "No spam guarantee" },
              { icon: Check, text: "Free for homeowners" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-[12.5px] font-semibold text-[#8b96a1]">
                <Icon size={14} className="text-[#ffb400]" /> {text}
              </div>
            ))}
          </div>

          <div className="reveal flex flex-wrap gap-3 items-center">
            <Link href="#listings" className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-7 py-3.5 rounded-xl hover:bg-[#e89e00] transition-colors">
              Browse directory <ArrowRight size={15} />
            </Link>
            {CLAIMED_DIRECTORY_PAGES_ENABLED && (
              <Link href="/directory/claim" className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-white underline underline-offset-4 decoration-white/30 hover:decoration-white/70 transition-colors px-2">
                Own a trade business? Claim your free listing
              </Link>
            )}
          </div>
        </div>
      </section>

      {hasActiveFilters ? (
        /* ═══════════════════════════════════════════
            RESULTS MODE: Sticky search + listings grid
        ═══════════════════════════════════════════ */
        <>
          {/* Sticky Search Bar */}
          <DirectorySearchForm
            trade={trade}
            postcode={postcode ?? suburb}
            search={search}
            reviews={reviews}
            rating={rating}
            sort={sort}
            radius={radius}
            count={count ?? 0}
          />

          {/* Main Content Area */}
          <div className="max-w-6xl mx-auto px-6 py-8">
            {error && (
              <div className="text-[13px] px-4 py-3 rounded-xl mb-6 font-semibold" style={{ background: "var(--red-bg)", color: "var(--red)" }}>
                Could not load directory: {error.message}
              </div>
            )}

            {/* Active filters summary */}
            {(trade || postcode || suburb || reviews || rating) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {trade && (
                  <Link href={buildUrl({ trade: undefined })} scroll={false} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-[var(--navy)] text-white hover:opacity-80 transition-opacity">
                    {TRADE_LABELS[trade]} <span className="opacity-60">&times;</span>
                  </Link>
                )}
                {(postcode || suburb) && (
                  <Link href={buildUrl({ postcode: undefined, suburb: undefined })} scroll={false} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-[var(--navy)] text-white hover:opacity-80 transition-opacity">
                    {postcode ?? suburb} <span className="opacity-60">&times;</span>
                  </Link>
                )}
                {reviews && (
                  <Link href={buildUrl({ reviews: undefined })} scroll={false} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-[var(--amber)] text-[var(--navy)] hover:opacity-80 transition-opacity">
                    {({"1-10": "1-10 reviews", "10-50": "10-50 reviews", "50-100": "50-100 reviews", "100-500": "100-500 reviews", "500+": "500+ reviews"} as Record<string,string>)[reviews] ?? reviews} <span className="opacity-60">&times;</span>
                  </Link>
                )}
                {rating && (
                  <Link href={buildUrl({ rating: undefined })} scroll={false} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-[var(--green-bg)] text-[var(--green)] hover:opacity-80 transition-opacity">
                    {({"4.5": "4.5+ stars", "4.0": "4.0+ stars", "3.5": "3.5+ stars"} as Record<string,string>)[rating] ?? rating} <span className="opacity-60">&times;</span>
                  </Link>
                )}
              </div>
            )}

            {/* Trade filter pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Link href={buildUrl({ trade: undefined })} scroll={false}
                className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${!trade ? "bg-[#0a1722] text-white border-[#0a1722]" : "bg-white hover:border-[#8b96a8]"}`}
                style={trade ? { borderColor: "var(--line)", color: "var(--ink-soft)" } : {}}>
                All trades
              </Link>
              {ALL_TRADES.map((t) => (
                <Link key={t} href={buildUrl({ trade: t })} scroll={false}
                  className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${trade === t ? "bg-[#0a1722] text-white border-[#0a1722]" : "bg-white hover:border-[#8b96a8]"}`}
                  style={trade !== t ? { borderColor: "var(--line)", color: "var(--ink-soft)" } : {}}>
                  {TRADE_LABELS[t]}
                </Link>
              ))}
            </div>

            {/* Directory grid */}
            {!listings?.length ? (
              <div className="rounded-2xl border text-center py-16" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
                <Search size={32} className="mx-auto mb-2" style={{ color: "var(--ink-faint)" }} />
                <p className="font-semibold mb-1" style={{ color: "var(--ink)" }}>No tradies found</p>
                <p className="text-[13.5px] mb-5" style={{ color: "var(--ink-soft)" }}>Try adjusting your filters.</p>
                <Link href="/directory" className="px-5 py-2.5 border rounded-xl text-[13.5px] font-semibold inline-flex transition-colors hover:opacity-80" style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
                  Clear all filters
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
                  <Link href={buildUrl({ page: String(page - 1) })} className="px-4 py-2 border rounded-xl text-[13px] font-semibold transition-colors hover:opacity-80" style={{ borderColor: "var(--line)", color: "var(--ink-soft)", background: "var(--surface)" }}>
                    &larr; Previous
                  </Link>
                )}
                <span className="text-[13px] px-4" style={{ color: "var(--ink-faint)" }}>Page {page} of {totalPages}</span>
                {page < totalPages && (
                  <Link href={buildUrl({ page: String(page + 1) })} className="px-4 py-2 border rounded-xl text-[13px] font-semibold transition-colors hover:opacity-80" style={{ borderColor: "var(--line)", color: "var(--ink-soft)", background: "var(--surface)" }}>
                    Next &rarr;
                  </Link>
                )}
              </div>
            )}

            {/* Social proof */}
            <section className="mt-20 sm:mt-24">
              <div className="text-center mb-10">
                <h2 className="font-display text-[1.8rem] sm:text-[2.2rem] mb-3" style={{ color: "var(--ink)" }}>What homeowners say</h2>
                <p className="text-[14px] sm:text-[15px] max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>
                  Real stories from homeowners who found their tradie through Swiftscope.
                </p>
              </div>
              <div className="grid sm:grid-cols-3 gap-5">
                {HOMEOWNER_REVIEWS.map((review, i) => (
                  <div key={review.name} className="reveal p-6 rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-md" style={{ background: "var(--surface)", borderColor: "var(--line)", animationDelay: `${i * 100}ms` }}>
                    <div className="flex items-center gap-0.5 mb-4">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={14} className={s <= review.rating ? "fill-[#f59e0b] text-[#f59e0b]" : "text-gray-200 fill-gray-200"} />
                      ))}
                    </div>
                    <p className="text-[13.5px] leading-relaxed mb-5 italic" style={{ color: "var(--ink-soft)" }}>&ldquo;{review.quote}&rdquo;</p>
                    <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: "var(--line-subtle)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white" style={{ background: "var(--navy)" }}>
                        {review.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>{review.name}</p>
                        <p className="text-[11.5px] font-semibold" style={{ color: "var(--ink-faint)" }}>{review.suburb} - Hired a {review.trade}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Bottom CTA */}
            <section className="mt-20 sm:mt-24">
              <div className="relative overflow-hidden rounded-3xl p-10 sm:p-14 text-center" style={{ background: "var(--navy)" }}>
                <div className="absolute w-[300px] h-[300px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,180,0,0.15) 0%, transparent 60%)", top: "-30%", right: "10%" }} />
                <div className="relative">
                  <h2 className="font-display text-[2rem] sm:text-[2.6rem] text-white mb-3">Ready to find the right tradie?</h2>
                  <p className="text-[14px] sm:text-[15px] max-w-lg mx-auto mb-8 text-[#8b96a1]">
                    Browse curated tradie profiles with real Google ratings. Free, always.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link href="#listings" className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-8 py-3.5 rounded-xl hover:bg-[#e89e00] transition-colors">
                      Browse directory <ArrowRight size={15} />
                    </Link>
                    <Link href="/signup" className="inline-flex items-center gap-2 text-white font-bold text-[14px] px-8 py-3.5 rounded-xl border border-white/25 hover:border-white/50 hover:bg-white/5 transition-all">
                      List your business
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      ) : (
        /* ═══════════════════════════════════════════
            SEARCH MODE: Hero search + how it works + social proof
        ═══════════════════════════════════════════ */
        <>
          {/* Hero search form */}
          <FindTradieHeroSearch count={count ?? 196} />

          {/* How it works section */}
          <section className="bg-white border-b" style={{ borderColor: "var(--line)" }}>
            <div className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
              <div className="text-center mb-12">
                <h2 className="font-display text-[1.8rem] sm:text-[2.2rem] mb-3" style={{ color: "var(--ink)" }}>
                  How homeowners find tradies on Swiftscope
                </h2>
                <p className="text-[14px] sm:text-[15px] max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>
                  Three simple steps to find the right tradie for your job.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-6 lg:gap-8">
                {[
                  { num: "01", icon: Search, title: "Search by trade & suburb", desc: "Tell us what you need (electrician, plumber, roofer, and more) and where you are." },
                  { num: "02", icon: ClipboardList, title: "Compare local tradies", desc: "Browse profiles with real Google ratings, reviews, photos, licences and services offered." },
                  { num: "03", icon: Phone, title: "Contact them directly", desc: "Call, visit their website, or request a quote straight from their page. No middleman, no waiting to be matched." },
                ].map(({ num, icon: Icon, title, desc }, i) => (
                  <div key={num} className="reveal group relative p-6 sm:p-8 rounded-2xl border text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                    style={{ borderColor: "var(--line)", background: "var(--surface)", animationDelay: `${i * 100}ms` }}>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-extrabold px-3 py-1 rounded-full border" style={{ background: "var(--amber-light)", color: "var(--navy)", borderColor: "var(--amber)" }}>
                      {num}
                    </div>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-transform duration-200 group-hover:scale-110" style={{ background: "var(--navy)" }}>
                      <Icon size={24} style={{ color: "var(--amber)" }} />
                    </div>
                    <h3 className="font-bold text-[16px] mb-2" style={{ color: "var(--ink)" }}>{title}</h3>
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Social proof + Bottom CTA */}
          <div className="max-w-6xl mx-auto px-6 py-8">
            {/* Social proof */}
            <section className="mt-20 sm:mt-24">
              <div className="text-center mb-10">
                <h2 className="font-display text-[1.8rem] sm:text-[2.2rem] mb-3" style={{ color: "var(--ink)" }}>What homeowners say</h2>
                <p className="text-[14px] sm:text-[15px] max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>
                  Real stories from homeowners who found their tradie through Swiftscope.
                </p>
              </div>
              <div className="grid sm:grid-cols-3 gap-5">
                {HOMEOWNER_REVIEWS.map((review, i) => (
                  <div key={review.name} className="reveal p-6 rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-md" style={{ background: "var(--surface)", borderColor: "var(--line)", animationDelay: `${i * 100}ms` }}>
                    <div className="flex items-center gap-0.5 mb-4">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={14} className={s <= review.rating ? "fill-[#f59e0b] text-[#f59e0b]" : "text-gray-200 fill-gray-200"} />
                      ))}
                    </div>
                    <p className="text-[13.5px] leading-relaxed mb-5 italic" style={{ color: "var(--ink-soft)" }}>&ldquo;{review.quote}&rdquo;</p>
                    <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: "var(--line-subtle)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white" style={{ background: "var(--navy)" }}>
                        {review.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>{review.name}</p>
                        <p className="text-[11.5px] font-semibold" style={{ color: "var(--ink-faint)" }}>{review.suburb} - Hired a {review.trade}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Bottom CTA */}
            <section className="mt-20 sm:mt-24">
              <div className="relative overflow-hidden rounded-3xl p-10 sm:p-14 text-center" style={{ background: "var(--navy)" }}>
                <div className="absolute w-[300px] h-[300px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,180,0,0.15) 0%, transparent 60%)", top: "-30%", right: "10%" }} />
                <div className="relative">
                  <h2 className="font-display text-[2rem] sm:text-[2.6rem] text-white mb-3">Ready to find the right tradie?</h2>
                  <p className="text-[14px] sm:text-[15px] max-w-lg mx-auto mb-8 text-[#8b96a1]">
                    Browse curated tradie profiles with real Google ratings. Free, always.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link href="#listings" className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-8 py-3.5 rounded-xl hover:bg-[#e89e00] transition-colors">
                      Browse directory <ArrowRight size={15} />
                    </Link>
                    <Link href="/signup" className="inline-flex items-center gap-2 text-white font-bold text-[14px] px-8 py-3.5 rounded-xl border border-white/25 hover:border-white/50 hover:bg-white/5 transition-all">
                      List your business
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
