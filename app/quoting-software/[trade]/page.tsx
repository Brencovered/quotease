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
import PhoneShot from "@/components/marketing/PhoneShot";
import { SHOTS, type Screenshot } from "@/lib/marketing/screenshots";
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

  // Every screenshot in the registry is a real capture of one specific
  // trade's builder -- there's no such thing as a neutral "materials
  // screen", only the electrician's, the plumber's, or the carpenter's,
  // each with that trade's own items and text in the pixels. Showing the
  // wrong trade's capture undercuts the exact claim this page is making
  // (a builder that knows your trade), so screens are looked up per trade
  // here rather than shared. quoteCapture is the one genuine exception --
  // it's the entry menu (camera, plan, drawings, voice), which has no
  // trade-specific text and is honest to show on any trade's page, so it
  // anchors wizard step 1 by default below.
  //
  // wizardShots is an explicit 4-slot array per trade rather than an
  // inferred "send is always step 4" rule, because that rule breaks for
  // roofers: their one real wizard-relevant capture (Standard/Premium
  // pricing plus whirlybird and skylight extras) is the job step, which
  // is step 3 ("Runs and extras") in this trade's own quotingFlow copy,
  // not step 4. Roofers and the two generic-builder trades don't have a
  // captured send screen at all yet, so that slot stays null for them --
  // no placeholder, the card just stays text-only.
  const TRADE_SCREENS: Record<
    string,
    { materials: Screenshot | null; packages: Screenshot | null; wizardShots: (Screenshot | null)[] }
  > = {
    electricians: {
      materials: SHOTS.materials,
      packages: SHOTS.packages,
      wizardShots: [SHOTS.quoteCapture, SHOTS.planMarkup, SHOTS.quoteJobPricing, SHOTS.quoteSend],
    },
    plumbers: {
      materials: SHOTS.plumberMaterials,
      packages: SHOTS.plumberPackages,
      wizardShots: [SHOTS.quoteCapture, SHOTS.plumberScope, SHOTS.plumberHotWater, SHOTS.plumberSend],
    },
    carpenters: {
      materials: SHOTS.carpenterMaterials,
      packages: SHOTS.carpenterPackages,
      wizardShots: [SHOTS.quoteCapture, null, null, SHOTS.carpenterSend],
    },
    roofers: {
      materials: SHOTS.roofingMaterials,
      packages: SHOTS.roofingPackages,
      wizardShots: [SHOTS.quoteCapture, SHOTS.roofingRoofType, SHOTS.roofingScope, null],
    },
    "painters-and-plasterers": {
      materials: null,
      packages: SHOTS.paintingPackages,
      wizardShots: [SHOTS.quoteCapture, null, null, SHOTS.paintingSend],
    },
  };
  const screens = TRADE_SCREENS[page.slug] ?? { materials: null, packages: null, wizardShots: [SHOTS.quoteCapture, null, null, null] };
  // screens.wizardShots is intentionally unread for now. The per-step
  // thumbnails it fed were removed because the grid cells were too narrow to
  // render a capture legibly, but the per-trade mapping above is correct and
  // worth keeping: it is what a future wide alternating row per step would
  // draw from.

  return (
    <main className="bg-white text-[#0a1722]">
      <MarketingNav />

      {/* HERO */}
      <div className="bg-[#0a1722]">
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-16 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-4">
              {page.dedicated ? "Dedicated quote builder" : "Built on the generic builder"}
            </p>
            <h1 className="font-display uppercase text-[2.5rem] sm:text-[3.1rem] leading-[0.92] text-white mb-4">
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
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-16 grid lg:grid-cols-2 gap-10">
          <div>
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
              Why {page.trade} switch
            </p>
            <h2 className="font-display uppercase text-[1.9rem] sm:text-[2.35rem] leading-[0.95] mb-4">
              Where the money<br />actually goes
            </h2>
            <p className="text-[15.5px] leading-[1.7] text-[#5a6a78] mb-4">{page.problem}</p>
            <p className="text-[15.5px] leading-[1.7] text-[#0a1722] font-medium">{page.answer}</p>
          </div>
          <div className="bg-[#f8f9fa] rounded-2xl p-6 border border-[#e8ecef]">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#5a6a78] mb-4">
              What generic job software gets wrong
            </p>
            <ul className="space-y-3">
              {page.genericFails.map((f) => (
                <li key={f} className="flex gap-3 items-start">
                  <X size={17} className="text-[#c94a3b] mt-1 shrink-0" />
                  <span className="text-[14.5px] leading-[1.6] text-[#5a6a78]">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Folded into the same block as the problem: three consecutive
              full-height list sections read as filler, and the argument is
              stronger when the fields sit directly under the complaint. */}
          <div className="lg:col-span-2 pt-10 mt-10 border-t border-[#e8ecef]">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-6">
              <h3 className="font-display uppercase text-[1.5rem]">What we ask for instead</h3>
              <p className="text-[14.5px] text-[#5a6a78]">
                {page.dedicated
                  ? "The fields that actually move the number."
                  : "Line items and units you define yourself."}
              </p>
            </div>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2.5">
              {page.prices.map((item) => (
                <li key={item} className="flex gap-2.5 items-start">
                  <Check size={16} className="text-[#ffb400] mt-[3px] shrink-0" />
                  <span className="text-[14.5px] leading-[1.55] text-[#0a1722]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* SETUP ── the objection that kills trade software adoption is not
          price, it is the fortnight of data entry people assume comes first.
          Deliberately a numbered row rather than another card grid: three
          identical grids in a row is what made this page feel padded. */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div className="max-w-[560px]">
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
                Getting started
              </p>
              <h2 className="font-display uppercase text-[1.9rem] sm:text-[2.35rem] leading-[0.95] mb-3">
                Set up in minutes,<br />not a fortnight
              </h2>
              <p className="text-[15.5px] leading-[1.7] text-[#5a6a78]">
                The reason most tradies never finish setting up job software is the data entry nobody
                warns them about. Swiftscope starts from the price file your supplier already sends you.
              </p>
            </div>
            <p className="text-[13px] text-[#5a6a78] max-w-[260px] border-l-2 border-[#ffb400] pl-4">
              Materials and labour stay split, so a supplier price rise shows up in your margin instead
              of hiding in it.
            </p>
          </div>

          {/* No screenshots in this row, deliberately, after four attempts at
              making them work here.

              These cards are about 400px wide with four lines of copy above
              the image. A PhoneStage needs roughly 290px for the capture to
              be readable, and its toast is absolutely positioned across the
              top of that capture. At 400px minus padding there is no width
              at which both fit: the phone was hard-capped at w-[160px] on
              two of the three cards, where the toast covered the entire
              phone, while the third had no cap at all and overflowed the
              card edge. Same row, two different sizing rules, neither
              working.

              The pattern is fine where there is room. The alternating
              full-width feature rows further down this page use it with a
              tall frame and they read well. The fault was the container,
              not the component, so the component stays and this row goes
              back to being three short text steps.

              Screenshots for materials, packages and pricing tiers all
              appear elsewhere on the page in contexts wide enough to show
              them properly. Nothing is lost by not repeating them at
              thumbnail size here. */}
          <div className="grid sm:grid-cols-3 gap-4 items-start">
            <div className="bg-white rounded-2xl border border-[#e8ecef] p-6">
              <div className="flex items-center gap-2.5 mb-3">
                <Upload size={17} className="text-[#ffb400]" />
                <span className="font-display text-[1.1rem] uppercase">01 Upload</span>
              </div>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78] mb-4">{page.setupMaterials}</p>
            </div>
            <div className="bg-white rounded-2xl border border-[#e8ecef] p-6">
              <div className="flex items-center gap-2.5 mb-3">
                <Package size={17} className="text-[#ffb400]" />
                <span className="font-display text-[1.1rem] uppercase">02 Bundle</span>
              </div>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78] mb-4">
                Save the job you quote most often as a package. After that it is one tap, not a rebuild.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-[#e8ecef] p-6">
              <div className="flex items-center gap-2.5 mb-3">
                <Check size={17} className="text-[#ffb400]" />
                <span className="font-display text-[1.1rem] uppercase">03 Set rates</span>
              </div>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78] mb-4">
                Your hourly rate, margin and terms become the baseline on every quote. Change them once
                and everything after follows.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white border border-[#e8ecef] p-6 flex flex-col sm:flex-row gap-5 sm:items-center">
            <div className="shrink-0">
              <p className="text-[10.5px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-1">
                Example package
              </p>
              <p className="font-display text-[1.3rem] uppercase">{page.packageName}</p>
            </div>
            <p className="text-[14.5px] leading-[1.6] text-[#5a6a78] sm:border-l sm:border-[#e8ecef] sm:pl-5">
              {page.packageContents}
            </p>
          </div>

          {/* Screenshots get their own full-width row, three across, plain
              PhoneShot with no overlay. This is how 300b82d had it and it
              was right: at 1232px container width three columns give each
              capture about 390px, which is enough to read the screen.

              The regression was d054ec8, "Embed each screenshot in its own
              step card". Inside a 400px text card a capture has to shrink to
              a thumbnail, and once a floating toast was added on top there
              was no width at which both fit. Ten commits went into trying to
              make that work. The row layout needs none of them. */}
          <div className="mt-10 pt-10 border-t border-[#e8ecef] grid grid-cols-1 sm:grid-cols-3 gap-8 items-start">
            {screens.materials && <PhoneShot shot={screens.materials} tone="light" />}
            {screens.packages && <PhoneShot shot={screens.packages} tone="light" />}
            <PhoneShot shot={SHOTS.pricingTiers} tone="light" />
          </div>
        </div>
      </div>

      {/* HOW QUOTING WORKS */}
      <div className="border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-16">
          <div className="max-w-[680px] mb-8">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
              How the quoting works
            </p>
            <h2 className="font-display uppercase text-[1.9rem] sm:text-[2.35rem] leading-[0.95] mb-4">
              Quoted before you<br />leave the driveway
            </h2>
            <p className="text-[15.5px] leading-[1.7] text-[#5a6a78]">
              The quote that wins is usually the one that arrives first, while the job is still fresh
              in the client&apos;s head. Everything below happens standing in the job, on a phone, one
              handed.
            </p>
          </div>

          {/* Text-only steps. These cards are half-width and carry a heading
              plus two lines of copy; there is no room left for a readable
              capture, which is why the wizardShots thumbnails were pulled
              from here. */}
          <div className="grid sm:grid-cols-2 gap-4 items-start">
            {page.quotingFlow.map((f, i) => {
              return (
                <div key={f.step} className="relative rounded-2xl p-6 bg-[#f8f9fa] border border-[#e8ecef]">
                  <span className="font-display text-[2.4rem] leading-none text-[#ffb400] block mb-3">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-[1.2rem] mb-2">{f.step}</h3>
                  <p className="text-[14.5px] leading-[1.6] text-[#5a6a78] mb-4">{f.detail}</p>
                </div>
              );
            })}
          </div>

          {/* The wizard itself, full width, three across. Placed after the
              four steps so the reader knows what they are looking at. */}
          <div className="mt-10 pt-10 border-t border-[#e8ecef] grid grid-cols-1 sm:grid-cols-3 gap-8 items-start">
            {screens.wizardShots.filter(Boolean).slice(0, 3).map((sh, i) => (
              <PhoneShot key={i} shot={sh!} tone="light" />
            ))}
          </div>

          <div className="mt-10 rounded-2xl bg-[#0a1722] p-6">
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
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-16">
          <div className="max-w-[680px] mb-8">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
              AI that knows your trade
            </p>
            <h2 className="font-display uppercase text-[1.9rem] sm:text-[2.35rem] leading-[0.95] mb-4">
              Two ways in, both on site
            </h2>
            <p className="text-[16px] leading-[1.7] text-[#5a6a78]">
              Swiftscope runs a different prompt for each trade, so it is reading your plan and
              listening to your description with your work in mind. You confirm every number before
              it reaches a client. The AI drafts, you decide.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-6 border border-[#e8ecef]">
              <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-4">
                <PenLine size={20} className="text-[#ffb400]" />
              </div>
              <h3 className="font-display text-[1.35rem] mb-3">Mark up the drawing</h3>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78]">{page.drawing}</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#e8ecef]">
              <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-4">
                <Mic size={20} className="text-[#ffb400]" />
              </div>
              <h3 className="font-display text-[1.35rem] mb-3">Or just talk</h3>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78] mb-4">
                Describe the job out loud, walking the site. Swiftscope turns it into priced line
                items you can correct before sending.
              </p>
              <p className="text-[14px] leading-[1.6] text-[#0a1722] italic border-l-2 border-[#ffb400] pl-4">
                {page.voiceExample}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#e8ecef]">
              <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-4">
                <FileText size={20} className="text-[#ffb400]" />
              </div>
              <h3 className="font-display text-[1.35rem] mb-3">Variations that stick</h3>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78]">{page.variation}</p>
            </div>
          </div>
        </div>
      </div>


      {/* JOB MANAGEMENT ── the quote is the start, not the deliverable. */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-16">
          <div className="max-w-[680px] mb-8">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
              After they say yes
            </p>
            <h2 className="font-display uppercase text-[1.9rem] sm:text-[2.35rem] leading-[0.95] mb-4">
              The quote becomes<br />the job
            </h2>
            <p className="text-[15.5px] leading-[1.7] text-[#5a6a78] mb-4">{page.afterAccept}</p>
            <p className="text-[15.5px] leading-[1.7] text-[#5a6a78]">
              Nothing is retyped between quote, job and invoice, which is where most double-entry and
              most disputes come from.
            </p>
          </div>

          {/* Embedded per card, same as setup and the quoting steps above.
              All four of these screens are trade-neutral -- none show an
              electrician's fields -- so unlike the two sections above,
              every trade gets the identical four here. "Schedule and
              crew" is the one loose pairing: there's no calendar screen
              in the set yet, so it takes the job screen, which is at
              least the closest thing to "the job you're now running". */}
          <div className="grid sm:grid-cols-2 gap-4 items-start">
            <div className="bg-white rounded-2xl p-6 border border-[#e8ecef]">
              <CalendarDays size={20} className="text-[#ffb400] mb-4" />
              <h3 className="font-display text-[1.15rem] mb-2">Schedule and crew</h3>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78] mb-4">
                Put the job in the calendar, assign who is on it, and see the week on a map so you are
                not crossing town twice.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#e8ecef]">
              <FileText size={20} className="text-[#ffb400] mb-4" />
              <h3 className="font-display text-[1.15rem] mb-2">Dockets and variations</h3>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78] mb-4">
                Day works signed on the spot on the client&apos;s phone, and variations accepted in
                writing before the extra work starts.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#e8ecef]">
              <Receipt size={20} className="text-[#ffb400] mb-4" />
              <h3 className="font-display text-[1.15rem] mb-2">Invoice and Xero</h3>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78] mb-4">
                Deposits, progress claims and final invoices built from the quote, pushed straight to
                Xero rather than exported and re-keyed.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#e8ecef]">
              <Check size={20} className="text-[#ffb400] mb-4" />
              <h3 className="font-display text-[1.15rem] mb-2">Margin, job by job</h3>
              <p className="text-[14.5px] leading-[1.6] text-[#5a6a78] mb-4">
                Hours and materials tracked against what you quoted, so you find out which jobs make
                money while you can still do something about it.
              </p>
            </div>
          </div>

          <div className="mt-10 pt-10 border-t border-[#e8ecef] grid grid-cols-1 sm:grid-cols-3 gap-8 items-start">
            <PhoneShot shot={SHOTS.jobDetail} tone="light" />
            <PhoneShot shot={SHOTS.docketsSigned} tone="light" />
            <PhoneShot shot={SHOTS.dashboard} tone="light" />
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div className="border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-16 text-center">
          <h2 className="font-display uppercase text-[1.9rem] sm:text-[2.35rem] leading-[0.95] mb-4">
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
        <div className="max-w-7xl mx-auto px-6 py-12">
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
