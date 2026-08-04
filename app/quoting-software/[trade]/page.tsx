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
import { ArrowRight, Check, Mic, PenLine, FileText, Upload, Package, CalendarDays, Receipt, X } from "lucide-react";
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


      {/* THE PROBLEM ── trade-specific differentiation. Leads with what they
          are up against rather than a feature list, because a tradie who
          does not recognise their own situation in the first screen leaves. */}
      <div className="border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-14">
          <div>
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
              Why {page.trade} switch
            </p>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.95] mb-5">
              Where the money<br />actually goes
            </h2>
            <p className="text-[16px] leading-[1.75] text-[#5a6a78] mb-5">{page.problem}</p>
            <p className="text-[16px] leading-[1.75] text-[#0a1722] font-medium">{page.answer}</p>
          </div>
          <div className="bg-[#f8f9fa] rounded-3xl p-8 border border-[#e8ecef]">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#5a6a78] mb-5">
              What generic job software gets wrong
            </p>
            <ul className="space-y-4">
              {page.genericFails.map((f) => (
                <li key={f} className="flex gap-3 items-start">
                  <X size={17} className="text-[#c94a3b] mt-1 shrink-0" />
                  <span className="text-[15px] leading-[1.65] text-[#5a6a78]">{f}</span>
                </li>
              ))}
            </ul>
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


      {/* SETUP ── the objection that kills trade software adoption is not
          price, it is the fortnight of data entry people assume comes first. */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-[680px] mb-12">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
              Getting started
            </p>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.95] mb-4">
              Set up in minutes,<br />not a fortnight
            </h2>
            <p className="text-[16px] leading-[1.75] text-[#5a6a78]">
              The reason most tradies never finish setting up job software is the data entry nobody
              warns them about. Swiftscope starts from the price file your supplier already sends you.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-7 border border-[#e8ecef]">
              <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-5">
                <Upload size={20} className="text-[#ffb400]" />
              </div>
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">Step one</p>
              <h3 className="font-display text-[1.35rem] mb-3">Upload your price file</h3>
              <p className="text-[15px] leading-[1.65] text-[#5a6a78]">{page.setupMaterials}</p>
            </div>

            <div className="bg-white rounded-2xl p-7 border border-[#e8ecef]">
              <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-5">
                <Package size={20} className="text-[#ffb400]" />
              </div>
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">Step two</p>
              <h3 className="font-display text-[1.35rem] mb-3">Save a package</h3>
              <p className="text-[15px] leading-[1.65] text-[#5a6a78] mb-4">
                Bundle the job you quote most often once, and it becomes a single tap forever after.
              </p>
              <div className="rounded-xl bg-[#f8f9fa] border border-[#e8ecef] p-4">
                <p className="text-[13px] font-bold text-[#0a1722] mb-1">{page.packageName}</p>
                <p className="text-[13.5px] leading-[1.6] text-[#5a6a78]">{page.packageContents}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-7 border border-[#e8ecef]">
              <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-5">
                <Check size={20} className="text-[#ffb400]" />
              </div>
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">Step three</p>
              <h3 className="font-display text-[1.35rem] mb-3">Set your rates once</h3>
              <p className="text-[15px] leading-[1.65] text-[#5a6a78]">
                Your hourly rate, your margin and your terms become the baseline on every quote. Change
                them once and every future quote follows, rather than editing each one by hand.
              </p>
            </div>
          </div>

          <p className="text-[14px] text-[#5a6a78] mt-8">
            Materials and labour stay split throughout, so when your supplier lifts prices you can see
            what it did to your margin instead of finding out at the end of the job.
          </p>
        </div>
      </div>

      {/* HOW QUOTING WORKS */}
      <div className="border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-[680px] mb-12">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
              How the quoting works
            </p>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.95] mb-4">
              Quoted before you<br />leave the driveway
            </h2>
            <p className="text-[16px] leading-[1.75] text-[#5a6a78]">
              The quote that wins is usually the one that arrives first, while the job is still fresh
              in the client&apos;s head. Everything below happens standing in the job, on a phone, one
              handed.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {page.quotingFlow.map((f, i) => (
              <div key={f.step} className="relative rounded-2xl p-6 bg-[#f8f9fa] border border-[#e8ecef]">
                <span className="font-display text-[2.4rem] leading-none text-[#ffb400] block mb-3">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-[1.2rem] mb-2">{f.step}</h3>
                <p className="text-[14.5px] leading-[1.6] text-[#5a6a78]">{f.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl bg-[#0a1722] p-8">
            <p className="text-[15px] leading-[1.75] text-[#c8d8e4]">
              <span className="text-white font-bold">Against a spreadsheet:</span> no hunting for the
              last similar job, no retyping client details, no formatting. <span className="text-white font-bold">Against
              a desktop tool:</span> no waiting until 9pm, which is the real reason quotes go out late
              or not at all.
            </p>
          </div>
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


      {/* JOB MANAGEMENT ── the quote is the start, not the deliverable. */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-[680px] mb-12">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
              After they say yes
            </p>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.95] mb-4">
              The quote becomes<br />the job
            </h2>
            <p className="text-[16px] leading-[1.75] text-[#5a6a78] mb-5">{page.afterAccept}</p>
            <p className="text-[16px] leading-[1.75] text-[#5a6a78]">
              Nothing is retyped between quote, job and invoice, which is where most double-entry and
              most disputes come from.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white rounded-2xl p-6 border border-[#e8ecef]">
              <CalendarDays size={20} className="text-[#ffb400] mb-4" />
              <h3 className="font-display text-[1.15rem] mb-2">Schedule and crew</h3>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78]">
                Put the job in the calendar, assign who is on it, and see the week on a map so you are
                not crossing town twice.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#e8ecef]">
              <FileText size={20} className="text-[#ffb400] mb-4" />
              <h3 className="font-display text-[1.15rem] mb-2">Dockets and variations</h3>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78]">
                Day works signed on the spot on the client&apos;s phone, and variations accepted in
                writing before the extra work starts.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#e8ecef]">
              <Receipt size={20} className="text-[#ffb400] mb-4" />
              <h3 className="font-display text-[1.15rem] mb-2">Invoice and Xero</h3>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78]">
                Deposits, progress claims and final invoices built from the quote, pushed straight to
                Xero rather than exported and re-keyed.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#e8ecef]">
              <Check size={20} className="text-[#ffb400] mb-4" />
              <h3 className="font-display text-[1.15rem] mb-2">Margin, job by job</h3>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78]">
                Hours and materials tracked against what you quoted, so you find out which jobs make
                money while you can still do something about it.
              </p>
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
