import Link from "next/link";
import type { Metadata } from "next";
import {
  Search,
  Shield,
  Star,
  Lock,
  Check,
  ClipboardList,
  MessageSquare,
  Award,
  ArrowRight,
  Sparkles,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import DirectoryCard from "@/components/DirectoryCard";
import { directoryMeta } from "@/lib/seo/meta";
import MarketingNav from "@/components/MarketingNav";
import AnimatedCounter from "./_components/AnimatedCounter";

export const metadata: Metadata = directoryMeta();

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

/** Review count range filters */
const REVIEW_RANGES = [
  { value: "", label: "Any reviews" },
  { value: "1-10", label: "1-10 reviews" },
  { value: "10-50", label: "10-50 reviews" },
  { value: "50-100", label: "50-100 reviews" },
  { value: "100-500", label: "100-500 reviews" },
  { value: "500+", label: "500+ reviews" },
];

/** Minimum rating filter */
const RATING_OPTIONS = [
  { value: "", label: "Any rating" },
  { value: "4.5", label: "4.5+ stars" },
  { value: "4.0", label: "4.0+ stars" },
  { value: "3.5", label: "3.5+ stars" },
];

/** Sort options */
const SORT_OPTIONS = [
  { value: "rating", label: "Highest rated" },
  { value: "reviews", label: "Most reviews" },
  { value: "name", label: "Name A-Z" },
];

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

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    trade?: string;
    suburb?: string;
    reviews?: string;
    rating?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const { trade, suburb, reviews, rating, sort, page: pageParam } = await searchParams;
  const page = parseInt(pageParam ?? "1");
  const perPage = 24;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const supabase = await createClient();

  let query = supabase
    .from("directory_listing")
    .select("*", { count: "exact" });

  // Trade filter
  if (trade) query = query.contains("trades", [trade]);

  // Suburb filter
  if (suburb) query = query.ilike("suburb", `%${suburb}%`);

  // Review count range filter
  if (reviews) {
    if (reviews === "500+") {
      query = query.gte("google_reviews_count", 500);
    } else if (reviews.includes("-")) {
      const [min, max] = reviews.split("-").map(Number);
      if (!isNaN(min)) query = query.gte("google_reviews_count", min);
      if (!isNaN(max)) query = query.lt("google_reviews_count", max);
    }
  }

  // Minimum rating filter
  if (rating) {
    const minRating = parseFloat(rating);
    if (!isNaN(minRating)) query = query.gte("google_rating", minRating);
  }

  // Sorting
  const activeSort = sort ?? "rating";
  if (activeSort === "reviews") {
    query = query
      .order("google_reviews_count", { ascending: false, nullsFirst: false })
      .order("google_rating", { ascending: false, nullsFirst: false });
  } else if (activeSort === "name") {
    query = query.order("business_name", { ascending: true });
  } else {
    // default: highest rated
    query = query
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("google_reviews_count", { ascending: false, nullsFirst: false });
  }

  query = query.range(from, to);

  const { data: listings, error, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / perPage);

  // Helper to build URLs preserving other filters
  function buildUrl(params: Record<string, string | undefined>): string {
    const sp = new URLSearchParams();
    if (trade) sp.set("trade", trade);
    if (suburb) sp.set("suburb", suburb);
    if (reviews) sp.set("reviews", reviews);
    if (rating) sp.set("rating", rating);
    if (sort) sp.set("sort", sort);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    return `/directory${qs ? `?${qs}` : ""}`;
  }

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

          <h1 className="reveal font-display text-[2.8rem] sm:text-[3.6rem] lg:text-[4.2rem] text-white leading-[1.05] mb-5">
            Find a trusted local tradie
          </h1>

          <p className="reveal text-[15px] sm:text-[16px] max-w-xl mb-10 leading-relaxed text-[#8b96a1]">
            A curated directory of local tradies with real Google reviews. Browse listings across Australia, or post your job and get up to 3 quotes.
          </p>

          <div
            className="reveal grid grid-cols-3 gap-6 sm:gap-10 max-w-lg mb-10 p-5 sm:p-6 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <AnimatedCounter target={196} suffix="+" label="Curated listings" />
            <AnimatedCounter target={50} suffix="+" label="Suburbs covered" delay={150} />
            <AnimatedCounter target={1200} suffix="+" label="Quotes sent" delay={300} />
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

          <div className="reveal flex flex-wrap gap-3">
            <Link href="/get-quotes" className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-7 py-3.5 rounded-xl hover:bg-[#e89e00] transition-colors">
              Get quotes <ArrowRight size={15} />
            </Link>
            <Link href="#listings" className="inline-flex items-center gap-2 text-white font-bold text-[14px] px-7 py-3.5 rounded-xl border border-white/25 hover:border-white/50 hover:bg-white/5 transition-all">
              Browse directory
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          HOW IT WORKS STRIP
      ═══════════════════════════════════════════ */}
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
              { num: "01", icon: ClipboardList, title: "Post your job", desc: "Describe what you need done, your suburb, and any budget or timing preferences." },
              { num: "02", icon: MessageSquare, title: "Get up to 3 quotes", desc: "Matched local tradies review your job and respond with detailed quotes." },
              { num: "03", icon: Award, title: "Hire with confidence", desc: "Compare ratings, read real reviews, and choose the right tradie for you." },
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

      {/* ═══════════════════════════════════════════
          STICKY SEARCH BAR  (with filters)
      ═══════════════════════════════════════════ */}
      <div id="listings" className="sticky top-0 z-20 border-b shadow-sm" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
        <form method="GET" className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap gap-2 items-center" onChange={(e) => { (e.currentTarget as HTMLFormElement).submit(); }}>
          {/* Trade select */}
          <select name="trade" defaultValue={trade ?? ""} className="app-field text-[13px] w-auto bg-white">
            <option value="">All trades</option>
            {ALL_TRADES.map((t) => <option key={t} value={t}>{TRADE_LABELS[t]}</option>)}
          </select>

          {/* Suburb input */}
          <div className="relative flex-1 min-w-[160px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
            <input type="text" name="suburb" defaultValue={suburb ?? ""} placeholder="Suburb..." className="app-field pl-8 text-[13px] w-full bg-white" />
          </div>

          {/* Review count filter */}
          <div className="relative">
            <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none" />
            <select name="reviews" defaultValue={reviews ?? ""} className="app-field pl-8 text-[13px] w-auto bg-white appearance-none pr-7">
              {REVIEW_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Rating filter */}
          <div className="relative">
            <Star size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none" />
            <select name="rating" defaultValue={rating ?? ""} className="app-field pl-8 text-[13px] w-auto bg-white appearance-none pr-7">
              {RATING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Sort */}
          <div className="relative">
            <ArrowUpDown size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none" />
            <select name="sort" defaultValue={activeSort} className="app-field pl-8 text-[13px] w-auto bg-white appearance-none pr-7">
              {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <button type="submit" className="bg-[#0a1722] text-white font-bold text-[13px] px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
            Search
          </button>

          {(trade || suburb || reviews || rating || sort) && (
            <Link href="/directory" className="text-[13px] font-semibold hover:opacity-70 transition-opacity" style={{ color: "var(--ink-faint)" }}>
              Clear all
            </Link>
          )}

          <span className="text-[12px] ml-auto hidden sm:block" style={{ color: "var(--ink-faint)" }}>
            {count ?? 0} result{count !== 1 ? "s" : ""}
            {trade ? ` - ${TRADE_LABELS[trade] ?? trade}` : ""}
            {suburb ? ` - ${suburb}` : ""}
            {reviews ? ` - ${REVIEW_RANGES.find((r) => r.value === reviews)?.label ?? reviews}` : ""}
            {rating ? ` - ${RATING_OPTIONS.find((r) => r.value === rating)?.label ?? rating}` : ""}
          </span>
        </form>
      </div>

      {/* ═══════════════════════════════════════════
          MAIN CONTENT AREA
      ═══════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="text-[13px] px-4 py-3 rounded-xl mb-6 font-semibold" style={{ background: "var(--red-bg)", color: "var(--red)" }}>
            Could not load directory: {error.message}
          </div>
        )}

        {/* Active filters summary */}
        {(trade || suburb || reviews || rating) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {trade && (
              <Link href={buildUrl({ trade: undefined })} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-[var(--navy)] text-white hover:opacity-80 transition-opacity">
                {TRADE_LABELS[trade]} <span className="opacity-60">-</span>
              </Link>
            )}
            {suburb && (
              <Link href={buildUrl({ suburb: undefined })} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-[var(--navy)] text-white hover:opacity-80 transition-opacity">
                {suburb} <span className="opacity-60">-</span>
              </Link>
            )}
            {reviews && (
              <Link href={buildUrl({ reviews: undefined })} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-[var(--amber)] text-[var(--navy)] hover:opacity-80 transition-opacity">
                {REVIEW_RANGES.find((r) => r.value === reviews)?.label ?? reviews} <span className="opacity-60">-</span>
              </Link>
            )}
            {rating && (
              <Link href={buildUrl({ rating: undefined })} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-[var(--green-bg)] text-[var(--green)] hover:opacity-80 transition-opacity">
                {RATING_OPTIONS.find((r) => r.value === rating)?.label ?? rating} <span className="opacity-60">-</span>
              </Link>
            )}
          </div>
        )}

        {/* Trade filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link href={buildUrl({ trade: undefined })}
            className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${!trade ? "bg-[#0a1722] text-white border-[#0a1722]" : "bg-white hover:border-[#8b96a1]"}`}
            style={trade ? { borderColor: "var(--line)", color: "var(--ink-soft)" } : {}}>
            All trades
          </Link>
          {ALL_TRADES.map((t) => (
            <Link key={t} href={buildUrl({ trade: t })}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${trade === t ? "bg-[#0a1722] text-white border-[#0a1722]" : "bg-white hover:border-[#8b96a1]"}`}
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
                Post your job for free and get up to 3 quotes from local tradies. No obligation, no spam.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/get-quotes" className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-8 py-3.5 rounded-xl hover:bg-[#e89e00] transition-colors">
                  Get quotes <ArrowRight size={15} />
                </Link>
                <Link href="/signup" className="inline-flex items-center gap-2 text-white font-bold text-[14px] px-8 py-3.5 rounded-xl border border-white/25 hover:border-white/50 hover:bg-white/5 transition-all">
                  List your business
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
