/**
 * app/[tradeSuburb]/page.tsx
 * ---------------------------
 * Programmatic editorial landing page for a trade × suburb combination,
 * e.g. /electricians-seaford-vic.
 *
 * This sits at the top level of the app directory, which means it could
 * technically swallow any single-segment URL. In practice Next.js always
 * prefers a more specific static route (app/login, app/signup, app/features
 * etc.) over a dynamic one at the same level, so existing routes are safe.
 * parseTradeSuburbSlug() also returns null (-> notFound()) for anything
 * that isn't a recognised {trade}-{suburb}-{state} pattern, which covers
 * the rest.
 *
 * ASSUMPTIONS:
 * - generateStaticParams pre-builds only combinations with real listings
 *   at build time (best for crawl budget + avoids empty pages getting
 *   indexed by accident). Combinations posted after build (dynamicParams)
 *   still resolve on-demand and get cached per the revalidate window.
 * - revalidate: 604800 (1 week) per the brief -- directory listings don't
 *   change fast enough to need anything shorter, and it keeps Supabase
 *   read volume sane as this scales to hundreds of suburbs.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Star, MapPin, Shield, ArrowRight, Phone, Globe } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTradeSuburbSlug, suburbToSlug, tradeToSlug, tradeSuburbMeta } from "@/lib/seo/meta";
import { generateTradeSuburbContent } from "@/lib/seo/generateTradeSuburbContent";
import FaqSchema from "@/components/seo/FaqSchema";
import { DirectoryPageSchema } from "@/components/seo/TradieSchema";
import MarketingNav from "@/components/MarketingNav";

export const revalidate = 604800; // 1 week, per brief

interface PageProps {
  params: Promise<{ tradeSuburb: string }>;
}

export async function generateStaticParams() {
  // Only pre-build combos that actually have listings -- avoids wasting
  // build time/crawl budget on empty pages. New combos still resolve
  // on-demand at runtime (dynamicParams defaults to true).
  try {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("directory_listing")
      .select("trades, suburb")
      .not("suburb", "is", null);

    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      for (const trade of row.trades ?? []) {
        const key = `${tradeToSlug(trade)}-${suburbToSlug(row.suburb)}-vic`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count >= 3)
      .map(([tradeSuburb]) => ({ tradeSuburb }));
  } catch (err) {
    // Build-time without Supabase env vars (CI) -- fall back to no
    // pre-rendered params; everything resolves on-demand at runtime instead.
    console.error("[trade-suburb generateStaticParams] skipped:", err);
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tradeSuburb } = await params;
  const parsed = parseTradeSuburbSlug(tradeSuburb);
  if (!parsed) return {};

  const content = await generateTradeSuburbContent(parsed.trade, parsed.suburbSlug, parsed.state);
  return tradeSuburbMeta(parsed.trade, content.suburb, parsed.state, content.listingCount, content.avgRating ?? undefined);
}

export default async function TradeSuburbPage({ params }: PageProps) {
  const { tradeSuburb } = await params;
  const parsed = parseTradeSuburbSlug(tradeSuburb);
  if (!parsed) notFound();

  const content = await generateTradeSuburbContent(parsed.trade, parsed.suburbSlug, parsed.state);
  const { tradeSingular, tradePlural, suburb, state, listingCount, avgRating, totalReviews, topListings, pricingRange, faqs } = content;

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
            <span className="text-white/70">{tradePlural} in {suburb}</span>
          </nav>
          <h1 className="font-display uppercase text-[2.4rem] sm:text-[3.2rem] leading-[0.95] text-white max-w-2xl mb-4">
            {tradePlural} in {suburb}, {state}
          </h1>
          <p className="text-[16px] text-[#8aa4b4] max-w-xl mb-6">
            {listingCount > 0
              ? `Compare ${listingCount} local ${tradePlural.toLowerCase()} in ${suburb}${avgRating ? ` with an average rating of ${avgRating.toFixed(1)} stars` : ""}. Get free quotes from curated listings.`
              : `Looking for a ${tradeSingular.toLowerCase()} in ${suburb}? Post your job and get quotes from local tradies as they join Swiftscope.`}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/get-quotes?trade=${parsed.trade}&suburb=${encodeURIComponent(suburb)}`} className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-7 py-3.5 rounded-xl hover:opacity-90">
              Get free quotes <ArrowRight size={15} />
            </Link>
            <Link href={`/directory?trade=${parsed.trade}&suburb=${encodeURIComponent(suburb)}`} className="inline-flex items-center gap-2 text-white font-bold text-[15px] px-6 py-3.5 rounded-xl border border-white/25 hover:border-white/50">
              Browse all {listingCount > 0 ? listingCount : ""} listings
            </Link>
          </div>
          {totalReviews > 0 && (
            <div className="flex items-center gap-4 mt-7 text-[13px] font-semibold text-[#8aa4b4]">
              <span className="flex items-center gap-1.5"><Shield size={14} className="text-[#ffb400]" /> Verified Google ratings</span>
              <span className="flex items-center gap-1.5"><Star size={14} className="text-[#ffb400]" /> {totalReviews.toLocaleString()} total reviews</span>
              <span className="flex items-center gap-1.5"><MapPin size={14} className="text-[#ffb400]" /> {suburb}, {state}</span>
            </div>
          )}
        </div>
      </div>

      {/* TOP LISTINGS */}
      {topListings.length > 0 && (
        <div className="bg-white border-b border-[#e8ecef]">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <h2 className="font-display uppercase text-[1.8rem] sm:text-[2.2rem] text-[#0a1722] mb-8">
              Top {tradePlural.toLowerCase()} in {suburb}
            </h2>
            <div className="space-y-3">
              {topListings.map((l, i) => (
                <Link
                  key={l.id}
                  href={`/directory/${l.slug}`}
                  className="flex items-center gap-4 bg-[#f8f9fa] border border-[#e8ecef] rounded-2xl p-5 hover:border-[#ffb400]/50 transition-colors"
                >
                  <span className="font-display text-[1.6rem] text-[#d6dde1] w-8 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[15px] text-[#0a1722] truncate">{l.business_name}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {l.google_rating != null && (
                        <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[#0a1722]">
                          <Star size={12} className="fill-[#ffb400] text-[#ffb400]" /> {l.google_rating.toFixed(1)}
                          {l.google_reviews_count != null && <span className="text-[#8a9ba8] font-normal">({l.google_reviews_count} reviews)</span>}
                        </span>
                      )}
                      {l.scraped_contact_phone && (
                        <span className="flex items-center gap-1 text-[12.5px] text-[#8a9ba8]"><Phone size={12} /> {l.scraped_contact_phone}</span>
                      )}
                      {l.website_url && (
                        <span className="flex items-center gap-1 text-[12.5px] text-[#8a9ba8]"><Globe size={12} /> Website</span>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-[#8a9ba8] shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NO LISTINGS YET -- still useful for conversion, not indexed (see meta) */}
      {listingCount === 0 && (
        <div className="bg-white border-b border-[#e8ecef]">
          <div className="max-w-5xl mx-auto px-6 py-16 text-center">
            <p className="font-display text-[1.6rem] text-[#0a1722] mb-2">No {tradePlural.toLowerCase()} listed in {suburb} yet</p>
            <p className="text-[14px] text-[#5a6a78] max-w-md mx-auto mb-6">
              Be the first to know when one joins, or post your job now - tradies from nearby suburbs may still be able to help.
            </p>
            <Link href={`/get-quotes?trade=${parsed.trade}&suburb=${encodeURIComponent(suburb)}`} className="inline-flex items-center gap-2 bg-[#0a1722] text-white font-extrabold text-[15px] px-7 py-3.5 rounded-xl hover:opacity-90">
              Post your job <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}

      {/* PRICING GUIDE */}
      {pricingRange && (
        <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
          <div className="max-w-5xl mx-auto px-6 py-14">
            <h2 className="font-display uppercase text-[1.6rem] text-[#0a1722] mb-3">
              How much does a {tradeSingular.toLowerCase()} cost in {suburb}?
            </h2>
            <p className="text-[15px] text-[#5a6a78] leading-relaxed max-w-2xl mb-2">
              {pricingRange}. Exact pricing depends on the job - get a free, no-obligation quote from a local {tradeSingular.toLowerCase()} to know exactly what your job will cost.
            </p>
            <p className="text-[12px] text-[#8a9ba8] italic">
              General market guide only, not specific to any one business or job. Always confirm pricing directly with your chosen tradie.
            </p>
          </div>
        </div>
      )}

      {/* FAQ */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="font-display uppercase text-[1.8rem] text-[#0a1722] mb-8">Frequently asked questions</h2>
          <div className="space-y-5">
            {faqs.map((faq) => (
              <div key={faq.question} className="border-b border-[#e8ecef] pb-5">
                <p className="font-bold text-[15px] text-[#0a1722] mb-2">{faq.question}</p>
                <p className="text-[14px] text-[#5a6a78] leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER CTA */}
      <div className="bg-[#0a1722]">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <h3 className="font-display text-[1.8rem] sm:text-[2.2rem] text-white mb-3">
            Need a {tradeSingular.toLowerCase()} in {suburb}?
          </h3>
          <p className="text-[#8aa4b4] text-[14px] mb-6">Get up to 3 free quotes from local tradies.</p>
          <Link href={`/get-quotes?trade=${parsed.trade}&suburb=${encodeURIComponent(suburb)}`} className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-8 py-4 rounded-xl hover:opacity-90">
            Get free quotes <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <FaqSchema faqs={faqs} />
      {topListings.length > 0 && (
        <DirectoryPageSchema
          trade={parsed.trade}
          suburb={suburb}
          state={state}
          listings={topListings.map((l) => ({
            business_name: l.business_name,
            slug: l.slug,
            google_rating: l.google_rating,
            google_reviews_count: l.google_reviews_count,
            logo_url: l.logo_url,
          }))}
        />
      )}
    </main>
  );
}
