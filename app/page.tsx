import Link from "next/link";
import SavingsCalculator from "@/components/SavingsCalculator";
import Image from "next/image";
import type { Metadata } from "next";
import {
  Home as HomeIcon, Briefcase, CheckCircle, ArrowRight,
  Crosshair, Mic, PenTool, FileSearch,
} from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import FaqSchema, { SWIFTSCOPE_FAQS } from "@/components/seo/FaqSchema";
import { homepageMeta } from "@/lib/seo/meta";
import { LEADS_ENABLED } from "@/lib/featureFlags";

export const metadata: Metadata = homepageMeta();

const HERO_IMG = "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=1800&q=85&auto=format&fit=crop";

export default function Home() {
  return (
    <main className="bg-white text-[#0a1722] overflow-hidden">

      {/* HERO */}
      <div className="relative h-screen min-h-[700px] max-h-[960px] flex items-end bg-[#0a1722]">
        <MarketingNav transparent />
        <div className="absolute inset-0 z-0">
          <Image src={HERO_IMG} alt="Tradie on site" fill sizes="100vw" className="object-cover object-center" priority />
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
              <span>196 curated tradie listings</span>
            </div>
          </div>
        </div>
      </div>

      {/* PRODUCT SHOWCASE - the first real look at the actual app, not just a stock photo */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-20 sm:pt-20 sm:pb-24">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">See it in action</p>
            <h2 className="font-display uppercase text-[2rem] sm:text-[2.6rem] leading-[0.95] text-[#0a1722]">
              This is what it actually looks like
            </h2>
          </div>
          <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
            <div className="relative w-[110px] sm:w-[150px] aspect-[453/918] rounded-xl overflow-hidden shadow-lg hidden md:block">
              <Image src="/marketing/v2/dashboard.png" alt="Swiftscope dashboard showing operations and business insights" fill sizes="150px" className="object-contain" />
            </div>
            <div className="relative w-[150px] sm:w-[210px] aspect-[453/918] rounded-2xl overflow-hidden shadow-2xl z-10 -mt-4 sm:-mt-8">
              <Image src="/marketing/v2/quoting.png" alt="Building a priced quote in Swiftscope" fill sizes="(max-width: 640px) 150px, 210px" className="object-contain" priority />
            </div>
            <div className="relative w-[110px] sm:w-[150px] aspect-[453/918] rounded-xl overflow-hidden shadow-lg hidden md:block">
              <Image src="/marketing/v2/job-management.png" alt="Job management board in Swiftscope" fill sizes="150px" className="object-contain" />
            </div>
          </div>
        </div>
      </div>

      {/* DIFFERENTIATORS - the core "built site-first" pitch */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Why tradies switch</p>
            <h2 className="font-display uppercase text-[2.6rem] sm:text-[3.2rem] leading-[0.93] text-[#0a1722] mb-4">
              Everything below happens<br />on site. Nothing waits for the desk.
            </h2>
            <p className="text-[15px] text-[#5a6a78] max-w-xl mx-auto">
              Four ways to turn what you see on site into a sent, priced quote - pick whichever fits how you work.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-10 items-start">
            <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-[#0a1722] rounded-xl flex items-center justify-center shrink-0">
                  <Crosshair size={18} className="text-[#ffb400]" />
                </div>
                <div>
                  <h3 className="font-display text-[1.25rem] text-[#0a1722] mb-1">Live on-screen quoting</h3>
                  <p className="text-[14px] text-[#5a6a78] leading-relaxed">
                    Mark straight onto your screen what needs capturing. Materials and labour autoload with your
                    own pricing. Press send.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-[#0a1722] rounded-xl flex items-center justify-center shrink-0">
                  <Mic size={18} className="text-[#ffb400]" />
                </div>
                <div>
                  <h3 className="font-display text-[1.25rem] text-[#0a1722] mb-1">AI voice quote generator</h3>
                  <p className="text-[14px] text-[#5a6a78] leading-relaxed">
                    Talk through the job and materials needed. A priced quote generates automatically using your
                    own pricing.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-[#0a1722] rounded-xl flex items-center justify-center shrink-0">
                  <PenTool size={18} className="text-[#ffb400]" />
                </div>
                <div>
                  <h3 className="font-display text-[1.25rem] text-[#0a1722] mb-1">Plan &amp; drawing markup</h3>
                  <p className="text-[14px] text-[#5a6a78] leading-relaxed">
                    Upload a plan, drop markers or draw runs. Every markup syncs straight into a quote, quantities
                    and costs already calculated.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-[#0a1722] rounded-xl flex items-center justify-center shrink-0">
                  <FileSearch size={18} className="text-[#ffb400]" />
                </div>
                <div>
                  <h3 className="font-display text-[1.25rem] text-[#0a1722] mb-1">AI plan reading</h3>
                  <p className="text-[14px] text-[#5a6a78] leading-relaxed">
                    Upload the plan, direct what needs reading and calculating, and save straight to a quote.
                  </p>
                  <p className="text-[12px] text-[#8a9ba8] italic mt-1">* AI output should always be checked before sending.</p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-3 order-1 lg:order-2 lg:sticky lg:top-24 flex justify-center">
              <div className="relative w-full max-w-[380px] aspect-[453/918] rounded-3xl overflow-hidden shadow-2xl">
                <Image src="/marketing/v2/quote-capture.png" alt="Capturing a quote live on site in Swiftscope" fill sizes="380px" className="object-contain" />
              </div>
            </div>
          </div>

          {/* Everything else */}
          <div className="mt-14 bg-[#0a1722] rounded-3xl p-8 md:p-10">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2 text-center">Plus everything else you&apos;d expect</p>
            <h3 className="font-display text-[1.8rem] text-white text-center mb-10">Running the rest of the business</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { img: "job-management-2.png", label: "Job & site management", value: "See every job's status, value and profit at a glance." },
                { img: "team-management.png", label: "Team management", value: "Assign jobs and tasks to your crew, from anywhere." },
                { img: "margins-pricing.png", label: "Margin & profit tracking", value: "Real margin on every job, not just a guess at tax time." },
                { img: "schedule.png", label: "Schedule & job calendar", value: "Jobs, follow-ups and quote expiries, all in one calendar." },
                { img: "dayworks-docket.png", label: "Dayworks dockets", value: "Signed, per-day work records that bundle into one EOM invoice." },
                { img: "materials-pricing.png", label: "Materials & price book", value: "Your own pricing, pulled straight into every quote automatically." },
                { img: "lead-gen.png", label: "Homeowner leads", value: "Included leads from the public directory, no auction, no per-lead cost." },
                { img: "quoting-customer-accepts.png", label: "Client accepts online", value: "Customer reviews and accepts the quote from their phone. You get notified." },
              ].map((f) => (
                <div key={f.label} className="bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
                  <div className="relative w-full max-w-[170px] mx-auto aspect-[453/918] mt-6">
                    <Image src={`/marketing/v2/${f.img}`} alt={f.label} fill sizes="170px" className="object-contain" />
                  </div>
                  <div className="p-4 mt-2">
                    <p className="font-display text-[1.05rem] text-white mb-1">{f.label}</p>
                    <p className="text-[13px] text-[#8aa4b4] leading-snug">{f.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-10">
              <Link href="/features" className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[#ffb400] hover:underline">
                See the full feature list <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* TWO AUDIENCES */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
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

            <div className="bg-[#0a1722] rounded-3xl p-8 overflow-hidden">
              <div className="w-12 h-12 bg-[#ffb400] rounded-2xl flex items-center justify-center mb-5">
                <Briefcase size={22} className="text-[#0a1722]" />
              </div>
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">Tradies &amp; Trade Businesses</p>
              <h3 className="font-display text-[1.8rem] text-white mb-3">Run your whole business</h3>
              <p className="text-[15px] text-[#8aa4b4] leading-relaxed mb-6">
                Quote, win, manage, and invoice jobs from your phone. Get homeowner leads
                in your area included with your plan - no auction, no per-lead cost.
              </p>
              <div className="space-y-3 mb-6">
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
              <div className="relative w-full max-w-[220px] mx-auto aspect-[453/918] rounded-2xl overflow-hidden mb-6">
                <Image src="/marketing/v2/quote-management.png" alt="Managing quotes and jobs in Swiftscope" fill sizes="220px" className="object-contain" />
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
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
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
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
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
        <div className="max-w-7xl mx-auto px-6 py-20 grid sm:grid-cols-2 gap-6">
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
