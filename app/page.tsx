import Link from "next/link";
import SavingsCalculator from "@/components/SavingsCalculator";
import Image from "next/image";
import type { Metadata } from "next";
import {
  Home as HomeIcon, Briefcase, CheckCircle, ArrowRight,
  ListChecks, TrendingUp,
  CalendarClock, FileText, Users2, RefreshCw,
} from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import FaqSchema, { SWIFTSCOPE_FAQS } from "@/components/seo/FaqSchema";
import { homepageMeta } from "@/lib/seo/meta";
import { LEADS_ENABLED } from "@/lib/featureFlags";
import { createPublicClient } from "@/lib/supabase/public";
import { TRADE_PAGES } from "@/lib/marketing/tradePages";
import { SHOTS } from "@/lib/marketing/screenshots";
import PhoneShot from "@/components/marketing/PhoneShot";
import FeatureSwitcher from "@/components/marketing/FeatureSwitcher";

// Rebuild daily. The homepage quoted "196 curated tradie listings" as a
// hardcoded string while the table held 4,889 -- understating the directory
// by 25x on the one page most visitors see. Reading it from the database
// means it cannot drift again.
export const revalidate = 86400;

// createPublicClient, NOT the cookie-aware server client: this page is
// prerendered, and touching cookies() in a prerender throws
// DYNAMIC_SERVER_USAGE. That exact mistake shipped every trade/suburb page
// empty and noindexed for weeks.
async function getListingCount(): Promise<number | null> {
  try {
    const { count, error } = await createPublicClient()
      .from("directory_listing")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return count ?? null;
  } catch (err) {
    console.error("[homepage] listing count failed:", err);
    return null; // fall back to omitting the stat rather than showing a wrong one
  }
}

export const metadata: Metadata = homepageMeta();

// Self-hosted rather than hotlinked. A remote hero means Vercel has to
// fetch and optimise the source on every cold cache, which is exactly the
// state a Lighthouse run hits, and it puts a third party on the critical
// path for the LCP element. Local file, re-encoded from PNG to progressive
// JPEG (5.9MB of PNGs across the set became 0.43MB).
const HERO_IMG = "/trades/hero-onsite.jpg";

// 16x9 blurred thumbnail, inlined. Shows a colour-matched smudge instead of
// a black rectangle while the hero decodes, with no extra request.

const HERO_BLUR =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAJABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBAm6IL0JFQ/ZZYFZ7jhO1aZ+9HTtd/5Bq/WmJWP//Z";

export default async function Home() {
  const listingCount = await getListingCount();
  return (
    <main className="bg-white text-[#0a1722] overflow-hidden">

      {/* HERO */}
      <div className="relative h-screen min-h-[700px] max-h-[960px] flex items-end bg-[#0a1722]">
        <MarketingNav transparent />
        <div className="absolute inset-0 z-0">
          <Image src={HERO_IMG} alt="Tradie cutting on site in dust mask and ear protection" fill sizes="100vw"
            className="object-cover object-center" priority placeholder="blur" blurDataURL={HERO_BLUR} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1722] via-[#0a1722]/50 to-[#0a1722]/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1722]/70 to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-24 w-full">
          <div className="max-w-[720px]">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 rounded-full bg-[#ffb400]" />
              <span className="text-[12px] font-bold text-white/80 uppercase tracking-widest">Built by tradies, for tradies - teams of 1 to 10</span>
            </div>
            <h1 className="font-display uppercase leading-[0.88] mb-6">
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[5.5rem] text-white">Scope it. Quote it.</span>
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[5.5rem] text-[#ffb400]">Win it on site.</span>
            </h1>
            <p className="text-[17px] sm:text-[18px] leading-[1.65] text-[#c8d8e4] max-w-[560px] mb-10">
              Swiftscope is built site-first - every tool is designed to be used standing in the job,
              not back at a desk. Mark it up, talk it through, or scope it live on screen, and send a
              priced quote before you&apos;ve left the driveway.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[16px] px-8 py-4 rounded-xl hover:bg-[#e89e00] transition-colors" style={{ boxShadow:"0 12px 32px rgba(255,180,0,.3)" }}>
                I&apos;m a tradie - start free
              </Link>
              <Link href="/directory" className="text-white font-bold text-[16px] px-6 py-4 rounded-xl border border-white/25 hover:border-white/50 transition-colors flex items-center gap-2">
                I need a tradie <ArrowRight size={16} />
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-[13px] font-semibold text-[#8aa4b4]">
              <span>7-day free trial - then $45/month</span>
              <span className="text-[#2a3a47]">|</span>
              <span>Unlimited users</span>
              <span className="text-[#2a3a47]">|</span>
              {listingCount !== null && (
                <span>{listingCount.toLocaleString("en-AU")} tradie listings</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* YOUR TRADE ─────────────────────────────────────────────────────
          Concrete proof that the product knows the difference between a
          switchboard and a rafter. The cards no longer carry a "Dedicated"
          badge, so nothing here distinguishes the four purpose-built
          builders from the two that run on the generic one. Each trade
          page still states which it is in its own hero. */}
      <div className="bg-[#0a1722] border-b border-[#12212f]">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-16">
          <div className="max-w-[680px] mb-8">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Your trade</p>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.9rem] leading-[0.93] text-white mb-5">
              A quote builder that<br />knows your trade
            </h2>
            <p className="text-[16px] leading-[1.7] text-[#8aa4b4]">
              Generic job software makes you bend your quote to fit its form. Swiftscope ships a
              separate builder per trade, so the fields are the ones you actually price on.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TRADE_PAGES.map((t) => (
              <Link
                key={t.slug}
                href={`/quoting-software/${t.slug}`}
                className="group rounded-2xl overflow-hidden bg-[#12212f] border border-white/10 hover:border-[#ffb400]/40 transition-colors flex flex-col"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={t.image}
                    alt={t.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#12212f] via-transparent to-transparent" />
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-display uppercase text-[1.25rem] text-white mb-2">{t.Trade}</h3>
                  <p className="text-[14px] leading-[1.6] text-[#8aa4b4] flex-1">{t.lede}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#ffb400] group-hover:gap-2.5 transition-all">
                    Quoting software for {t.trade} <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-10">
            <Link href="/signup" className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-7 py-3.5 rounded-xl hover:bg-[#e89e00] transition-colors">
              Start free for 7 days <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* DIFFERENTIATORS - the core "built site-first" pitch */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-16">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Why tradies switch</p>
            <h2 className="font-display uppercase text-[2.6rem] sm:text-[3.2rem] leading-[0.93] text-[#0a1722] mb-4">
              Everything below happens<br />on site. Nothing waits for the desk.
            </h2>
            <p className="text-[15px] text-[#5a6a78] max-w-xl mx-auto">
              Four ways to turn what you see on site into a sent, priced quote - pick whichever fits how you work.
            </p>
          </div>

          {/* Interactive rather than four static cards: one large screenshot
              driven by a tab strip, in the style of the software this section
              is trying to convince someone to switch away from. Picking a
              mode is a more active thing to do on the page than scrolling
              past a row of cards, and the active tab decides which claim
              gets the full-size screenshot. */}
          <FeatureSwitcher
            modes={[
              {
                key: "camera",
                icon: "crosshair",
                kicker: "Live markup",
                title: "Live on-screen quoting",
                bullets: [
                  "Open Swiftscope and mark straight onto your screen.",
                  "Materials and labour autoload with your pre-set pricing.",
                  "Press send - quote's away before you're off site.",
                ],
                pullLine: "Customers can accept in 30 seconds from send.",
                shot: SHOTS.liveCameraMarkup,
                toast: { icon: "ruler", title: "0.62m", subtitle: "Conduit run - added to the quote" },
              },
              {
                key: "voice",
                icon: "mic",
                kicker: "Voice quoting",
                title: "AI voice quote generator",
                bullets: [
                  "Walk the job and describe the work out loud.",
                  "A quote drafts automatically from what you said.",
                  "Or record it on the drive home - same result either way.",
                ],
                pullLine: "Customers can accept in 30 seconds from end of recording.",
                shot: SHOTS.quoteSend,
                toast: { icon: "check", title: "Quote ready - $1,181", subtitle: "8 downlights, priced and ready to send" },
              },
              {
                key: "plan",
                icon: "pen-tool",
                kicker: "Plan markup",
                title: "Plan & drawing markup",
                bullets: [
                  "Upload a plan or drawing from your phone.",
                  "Drop markers, draw runs, or block out zones.",
                  "Every markup becomes a priced line, instantly.",
                ],
                pullLine: "Every marked zone becomes a priced line, automatically.",
                shot: SHOTS.planMarkup,
                toast: { icon: "pin", title: "$282", subtitle: "10 downlights placed on the plan" },
              },
              {
                key: "ai-read",
                icon: "file-search",
                kicker: "AI reading",
                title: "AI plan reading",
                bullets: [
                  "Upload the plan - no need to read it yourself.",
                  "Direct what needs calculating for the job.",
                  "Save straight to a quote, ready to check and send.",
                ],
                pullLine: "Hand it a plan instead of reading one yourself.",
                footnote: "* AI output should always be checked by a qualified person before sending.",
                shot: SHOTS.quoteCapture,
                toast: { icon: "file", title: "Plan uploaded", subtitle: "AI reads it and quotes the job" },
              },
            ]}
          />

          {/* Everything else */}
          <div className="mt-14 bg-[#0a1722] rounded-3xl p-8 md:p-10">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2 text-center">Plus everything else you&apos;d expect</p>
            <h3 className="font-display text-[1.8rem] text-white text-center mb-8">Running the rest of the business</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
              {[
                { icon: Briefcase,     label: "Job & site management" },
                { icon: ListChecks,    label: "Tasks for your team" },
                { icon: TrendingUp,    label: "Margin & profit tracking" },
                { icon: CalendarClock, label: "Schedule & quote expiry tracking" },
                { icon: FileText,      label: "Standard quote builder" },
                { icon: Users2,        label: "Client list & job history" },
                { icon: RefreshCw,     label: "Xero live sync" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <f.icon size={17} className="text-[#ffb400] shrink-0" />
                  <span className="text-[14px] font-semibold text-white">{f.label}</span>
                </div>
              ))}
            </div>
            {/* "Everything else you'd expect" is the easiest line on the page
                to write and the easiest to disbelieve, so three of the less
                glamorous screens sit under it. Small on purpose: supporting
                evidence, not another feature pitch. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 mt-10 pt-8 border-t border-white/10">
              <PhoneShot shot={SHOTS.clients} tone="dark" sizes="(max-width: 640px) 45vw, 250px" />
              <PhoneShot shot={SHOTS.team} tone="dark" sizes="(max-width: 640px) 45vw, 250px" />
              <PhoneShot shot={SHOTS.dayworksRates} tone="dark" sizes="(max-width: 640px) 45vw, 250px" />
              <PhoneShot shot={SHOTS.settingsSiteConditions} tone="dark" sizes="(max-width: 640px) 45vw, 250px" />
            </div>

            <div className="text-center mt-10">
              <Link href="/features" className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[#ffb400] hover:underline">
                See the full feature list <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* The two rows of eight static phones that used to sit here were
          re-proving claims the FeatureSwitcher above and the trade page
          strips already make, with none of the interactivity. Deleted
          rather than kept "for proof": four of those eight shots resurface
          properly-sized on /quoting-software, and repeating them here just
          added scroll length. */}

      {/* TWO AUDIENCES */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-16">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Who it&apos;s for</p>
            <h2 className="font-display uppercase text-[2.8rem] sm:text-[3.5rem] leading-[0.93] text-[#0a1722]">
              Built for both sides<br />of every job
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#f8f9fa] rounded-3xl p-8 border border-[#e8ecef]">
              <div className="w-12 h-12 bg-[#0a1722] rounded-2xl flex items-center justify-center mb-5">
                <HomeIcon size={22} className="text-[#ffb400]" />
              </div>
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">Homeowners &amp; Builders</p>
              <h3 className="font-display text-[1.8rem] text-[#0a1722] mb-3">Find and hire the right tradie</h3>
              <p className="text-[15px] text-[#5a6a78] leading-relaxed mb-6">
                Browse curated tradie profiles by trade and suburb. Real Google ratings on
                every listing, no lead auction, no dodgy reviews - just tradies who run
                their business here.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  "Search by trade and suburb",
                  "Real Google ratings on every listing",
                  "Contact tradies directly - call, email or visit their site",
                  "Free for homeowners, always",
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-[14px] font-semibold text-[#0a1722]">
                    <CheckCircle size={16} className="text-[#ffb400] shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <Link href="/directory" className="flex items-center justify-center gap-2 bg-[#0a1722] text-white font-extrabold text-[15px] py-4 rounded-xl hover:opacity-90 transition-opacity">
                Browse the directory <ArrowRight size={15} />
              </Link>
            </div>

            <div className="bg-[#0a1722] rounded-3xl p-8">
              <div className="w-12 h-12 bg-[#ffb400] rounded-2xl flex items-center justify-center mb-5">
                <Briefcase size={22} className="text-[#0a1722]" />
              </div>
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">Tradies &amp; Trade Businesses</p>
              <h3 className="font-display text-[1.8rem] text-white mb-3">Run your whole business</h3>
              <p className="text-[15px] text-[#8aa4b4] leading-relaxed mb-6">
                Quote, win, manage, and invoice jobs from your phone. Get homeowner leads
                in your area included with your plan - no auction, no per-lead cost.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  "Quote from your phone in 4 minutes on site",
                  "Homeowner leads included in your plan",
                  "Job management, scheduling, drawing markup",
                  "Xero live sync - no double entry",
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-[14px] font-semibold text-white">
                    <CheckCircle size={16} className="text-[#ffb400] shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <Link href="/signup" className="flex items-center justify-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] py-4 rounded-xl hover:opacity-90 transition-opacity">
                Start free trial - 7 days, no card <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <div className="text-center mt-10">
            <Link href="/features" className="text-[14px] font-bold text-[#0a1722] hover:text-[#e89e00] underline">
              See the full feature list →
            </Link>
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-16">
          <div className="text-center mb-8">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Pricing</p>
            <h2 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-[#0a1722]">Simple. Flat. No surprises.</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="bg-[#0a1722] rounded-3xl overflow-hidden">
              <div className="h-3" style={{ background:"repeating-linear-gradient(135deg,#FFB400 0 14px,#E89E00 14px 28px)" }} />
              <div className="p-8">
                <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">For tradies</p>
                <div className="flex items-end gap-2 mb-1">
                  <span className="font-display text-[4rem] leading-none text-[#ffb400]">$45</span>
                  <span className="text-[#7e94a2] text-[16px] font-bold mb-2">/month</span>
                </div>
                <p className="text-[#7e94a2] text-[13px] mb-6">7-day free trial. No card needed.</p>
                <div className="space-y-2.5 mb-8">
                  {["Unlimited quotes and jobs","Unlimited team members","Job management and scheduling","Drawing markup","Xero live sync","Client portal and online acceptance"].map(f => (
                    <div key={f} className="flex items-center gap-2.5 text-[13.5px] text-white">
                      <CheckCircle size={14} className="text-[#ffb400] shrink-0" /> {f}
                    </div>
                  ))}
                </div>
                <Link href="/signup" className="block text-center bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] py-3.5 rounded-xl hover:opacity-90">
                  Start free trial
                </Link>
              </div>
            </div>

            <div className="bg-[#f8f9fa] rounded-3xl border border-[#e8ecef] p-8 flex flex-col">
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">Directory included</p>
              <div className="flex items-end gap-2 mb-1">
                <span className="font-display text-[2.5rem] leading-none text-[#0a1722]">Included</span>
              </div>
              <p className="text-[#8a9ba8] text-[13px] mb-6">With every Swiftscope plan.</p>
              <div className="space-y-2.5 mb-8 flex-1">
                {["Listed in the public tradie directory","Homeowner quote requests in your area","Set your service suburbs and radius","No per-lead costs. Ever."].map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-[13.5px] text-[#0a1722]">
                    <CheckCircle size={14} className="text-[#ffb400] shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <Link href="/signup" className="block text-center bg-[#0a1722] text-white font-extrabold text-[15px] py-3.5 rounded-xl hover:opacity-90">
                Get listed
              </Link>
              <p className="text-[12px] text-[#8a9ba8] text-center mt-3">Free for homeowners - always</p>
            </div>
          </div>
          <p className="text-center text-[13px] text-[#8a9ba8] mt-8">
            Curious how we stack up against Fergus, ServiceM8, and the rest?{" "}
            <Link href="/features" className="font-bold text-[#0a1722] underline">See the comparison</Link>
          </p>
        </div>
      </div>

      {/* SAVINGS CALCULATOR */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-16">
          <div className="text-center mb-8">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Savings calculator</p>
            <h2 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-[#0a1722] mb-4">
              See what you&apos;d save switching to Swiftscope
            </h2>
            <p className="text-[15px] text-[#5a6a78] max-w-xl mx-auto">
              Select the platforms you&apos;re currently paying for, adjust seat count and pricing, then calculate.
            </p>
          </div>
          <SavingsCalculator />
        </div>
      </div>

      {/* FOOTER CTA */}
      <div className="bg-[#0a1722]">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-16 grid sm:grid-cols-2 gap-6">
          <div className="bg-white/[0.04] rounded-2xl p-8 border border-white/10">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Tradies</p>
            <h3 className="font-display text-[1.8rem] text-white mb-2">The other tradie just sent their quote.</h3>
            <p className="text-[#8aa4b4] text-[14px] mb-6">How long does yours take?</p>
            <Link href="/signup" className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-8 py-4 rounded-xl hover:opacity-90">
              Start quoting today <ArrowRight size={15} />
            </Link>
          </div>
          <div className="bg-white/[0.04] rounded-2xl p-8 border border-white/10">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Homeowners</p>
            <h3 className="font-display text-[1.8rem] text-white mb-2">Need something done?</h3>
            <p className="text-[#8aa4b4] text-[14px] mb-6">Browse curated tradie profiles in your suburb, free, always.</p>
            <Link href="/directory" className="inline-flex items-center gap-2 bg-white text-[#0a1722] font-extrabold text-[15px] px-8 py-4 rounded-xl hover:opacity-90">
              Find a tradie <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <div className="border-t border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-lg text-white">SWIFTSCOPE</span>
            <div className="flex gap-6 text-[12.5px] font-semibold text-white/40">
              <Link href="/features" className="hover:text-white transition-colors">Features</Link>
              <Link href="/how-it-works" className="hover:text-white transition-colors">How it works</Link>
              <Link href="/directory" className="hover:text-white transition-colors">Directory</Link>
              <Link href="/areas" className="hover:text-white transition-colors">Areas we cover</Link>
              {LEADS_ENABLED && (
                <Link href="/get-quotes" className="hover:text-white transition-colors">Get quotes</Link>
              )}
              <Link href="/login" className="hover:text-white transition-colors">Log in</Link>
              <Link href="/signup" className="hover:text-white transition-colors">Sign up</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ section - visible to users and indexed by Google as FAQPage rich result */}
      <div className="bg-[#f8f9fa] border-t border-[#e8ecef]">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="font-display uppercase text-[2rem] text-[#0a1722] mb-8">Common questions</h2>
          <div className="space-y-5">
            {SWIFTSCOPE_FAQS.map((faq) => (
              <div key={faq.question} className="border-b border-[#e8ecef] pb-5">
                <p className="font-bold text-[15px] text-[#0a1722] mb-2">{faq.question}</p>
                <p className="text-[14px] text-[#5a6a78] leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FaqSchema faqs={SWIFTSCOPE_FAQS} />
    </main>
  );
}
