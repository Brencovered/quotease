/**
 * /quoting-software/[trade]
 *
 * One substantial page per trade, targeting "quoting software for
 * {trade}" and its variants. These keywords were already in the tracked
 * SaaS set with no page behind them: the SaaS side of the site was three
 * pages of abstract copy competing against ServiceM8, Tradify, Fergus and
 * SimPro, all of whom have years of content. Google had nothing of ours to
 * return. This gives it something specific.
 *
 * Route placement matters. `app/[tradeSuburb]` is a root-level dynamic
 * segment that would otherwise swallow any single-segment path, so these
 * live under the static `/quoting-software` prefix, which Next resolves
 * ahead of the dynamic sibling. The prefix is also the keyword, so the URL
 * reads as what the page is.
 *
 * Prerendered with a weekly revalidate, matching the other SEO routes. No
 * Supabase call here, so there is no cookie/prerender hazard.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Mic, PenLine, FileText } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import { TRADE_PAGES, getTradePage } from "@/lib/marketing/tradePages";

export const revalidate = 604800; // 1 week, same cadence as the other SEO pages

const BASE_URL = "https://swiftscope.com.au";

export function generateStaticParams() {
  return TRADE_PAGES.map((t) => ({ trade: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ trade: string }>;
}): Promise<Metadata> {
  const { trade } = await params;
  const page = getTradePage(trade);
  if (!page) return {};

  const url = `${BASE_URL}/quoting-software/${page.slug}`;
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url,
      type: "website",
      images: [{ url: `${BASE_URL}${page.image}`, width: 800, height: 455, alt: page.alt }],
    },
  };
}

export default async function TradeQuotingPage({
  params,
}: {
  params: Promise<{ trade: string }>;
}) {
  const { trade } = await params;
  const page = getTradePage(trade);
  if (!page) notFound();

  const others = TRADE_PAGES.filter((t) => t.slug !== page.slug);

  return (
    <main className="bg-white text-[#0a1722]">
      <MarketingNav />

      {/* HERO */}
      <div className="bg-[#0a1722]">
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-4">
              {page.dedicated ? "Dedicated quote builder" : "Built on the generic builder"}
            </p>
            <h1 className="font-display uppercase text-[2.8rem] sm:text-[3.6rem] leading-[0.92] text-white mb-5">
              Quoting software<br />for {page.trade}
            </h1>
            <p className="text-[17px] leading-[1.7] text-[#c8d8e4] mb-8 max-w-[520px]">{page.lede}</p>
            <div className="flex flex-wrap gap-3 mb-6">
              <Link
                href="/signup"
                className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[16px] px-7 py-4 rounded-xl hover:bg-[#e89e00] transition-colors"
              >
                Start free for 7 days
              </Link>
              <Link
                href="/how-it-works"
                className="text-white font-bold text-[16px] px-6 py-4 rounded-xl border border-white/25 hover:border-white/50 transition-colors flex items-center gap-2"
              >
                See how it works <ArrowRight size={16} />
              </Link>
            </div>
            <p className="text-[13px] font-semibold text-[#8aa4b4]">
              $45/month flat, unlimited users, unlimited quotes
            </p>
          </div>
          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-white/10">
            <Image
              src={page.image}
              alt={page.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </div>

      {/* WHAT IT PRICES ── the credibility section. Every bullet is a real
          field in this trade's intake type, not a generic benefit. */}
      <div className="border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-[680px] mb-10">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
              What it prices
            </p>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.95] mb-4">
              The fields you actually price on
            </h2>
            <p className="text-[16px] leading-[1.7] text-[#5a6a78]">
              {page.dedicated
                ? `Not a blank line-item table with your trade written at the top. The ${page.trade} builder asks for the things that change the number.`
                : `A builder you shape to your own line items, rather than one that forces ${page.trade} into someone else's template.`}
            </p>
          </div>
          <ul className="grid sm:grid-cols-2 gap-x-10 gap-y-4">
            {page.prices.map((item) => (
              <li key={item} className="flex gap-3 items-start">
                <Check size={18} className="text-[#ffb400] mt-1 shrink-0" />
                <span className="text-[15px] leading-[1.65] text-[#0a1722]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* AI ── three real capabilities: trade-aware drawing analysis,
          trade-aware voice quoting, and variations. */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-[680px] mb-12">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
              AI that knows your trade
            </p>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.95] mb-4">
              Two ways in, both on site
            </h2>
            <p className="text-[16px] leading-[1.7] text-[#5a6a78]">
              Swiftscope runs a different prompt for each trade, so it is reading your plan and
              listening to your description with your work in mind. You confirm every number before
              it reaches a client. The AI drafts, you decide.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-7 border border-[#e8ecef]">
              <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-5">
                <PenLine size={20} className="text-[#ffb400]" />
              </div>
              <h3 className="font-display text-[1.35rem] mb-3">Mark up the drawing</h3>
              <p className="text-[15px] leading-[1.65] text-[#5a6a78]">{page.drawing}</p>
            </div>

            <div className="bg-white rounded-2xl p-7 border border-[#e8ecef]">
              <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-5">
                <Mic size={20} className="text-[#ffb400]" />
              </div>
              <h3 className="font-display text-[1.35rem] mb-3">Or just talk</h3>
              <p className="text-[15px] leading-[1.65] text-[#5a6a78] mb-4">
                Describe the job out loud, walking the site. Swiftscope turns it into priced line
                items you can correct before sending.
              </p>
              <p className="text-[14px] leading-[1.6] text-[#0a1722] italic border-l-2 border-[#ffb400] pl-4">
                {page.voiceExample}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-7 border border-[#e8ecef]">
              <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-5">
                <FileText size={20} className="text-[#ffb400]" />
              </div>
              <h3 className="font-display text-[1.35rem] mb-3">Variations that stick</h3>
              <p className="text-[15px] leading-[1.65] text-[#5a6a78]">{page.variation}</p>
            </div>
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div className="border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.95] mb-4">
            $45 a month. That is the whole price.
          </h2>
          <p className="text-[16px] leading-[1.7] text-[#5a6a78] max-w-[560px] mx-auto mb-8">
            No per-user fee, so putting your apprentice on it costs nothing. No per-job credits, so a
            flat-out month costs the same as a quiet one. No per-lead charge on directory enquiries.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[16px] px-8 py-4 rounded-xl hover:bg-[#e89e00] transition-colors"
          >
            Start your free trial <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* OTHER TRADES ── real internal linking between the SaaS pages, which
          the site had almost none of. */}
      <div className="bg-[#0a1722]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="font-display uppercase text-[1.6rem] text-white mb-8">Other trades</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {others.map((t) => (
              <Link
                key={t.slug}
                href={`/quoting-software/${t.slug}`}
                className="group rounded-xl overflow-hidden bg-[#12212f] border border-white/10 hover:border-[#ffb400]/40 transition-colors"
              >
                <div className="relative aspect-[16/9]">
                  <Image
                    src={t.image}
                    alt={t.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, 20vw"
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  />
                </div>
                <p className="p-4 font-display uppercase text-[1rem] text-white">{t.Trade}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
