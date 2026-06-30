import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  Home as HomeIcon, Briefcase, CheckCircle, ArrowRight,
  Crosshair, Mic, PenTool, FileSearch, ListChecks, TrendingUp,
  CalendarClock, FileText, Users2, RefreshCw,
} from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import FaqSchema, { SWIFTSCOPE_FAQS } from "@/components/seo/FaqSchema";
import { homepageMeta } from "@/lib/seo/meta";

export const metadata: Metadata = homepageMeta();

const HERO_IMG = "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=1800&q=85&auto=format&fit=crop";

export default function Home() {
  return (
    <main className="bg-white text-[#0a1722] overflow-hidden">

      {/* HERO */}
      <div className="relative h-screen min-h-[700px] max-h-[960px] flex items-end bg-[#0a1722]">
        <MarketingNav transparent />
        <div className="absolute inset-0 z-0">
          <Image src={HERO_IMG} alt="Tradie on site" fill className="object-cover object-center" priority unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1722] via-[#0a1722]/50 to-[#0a1722]/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1722]/70 to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-24 w-full">
          <div className="max-w-[720px]">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 rounded-full bg-[#ffb400]" />
              <span className="text-[12px] font-bold text-white/80 uppercase tracking-widest">Built by a tradie, for tradies - teams of 1 to 10</span>
            </div>
            <h1 className="font-display uppercase leading-[0.88] mb-6">
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[5.5rem] text-white">Scope it. Quote it.</span>
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[5.5rem] text-[#ffb400]">Win it on site.</span>
            </h1>
            <p className="text-[17px] sm:text-[18px] leading-[1.65] text-[#c8d8e4] max-w-[560px] mb-10">
              Swiftscope is built site-first — every tool is designed to be used standing in the job,
              not back at a desk. Mark it up, talk it through, or scope it live on screen, and send a
              priced quote before you&apos;ve left the driveway.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[16px] px-8 py-4 rounded-xl hover:bg-[#e89e00] transition-colors" style={{ boxShadow:"0 12px 32px rgba(255,180,0,.3)" }}>
                I&apos;m a tradie - start free
              </Link>
              <Link href="/get-quotes" className="text-white font-bold text-[16px] px-6 py-4 rounded-xl border border-white/25 hover:border-white/50 transition-colors flex items-center gap-2">
                I need a tradie <ArrowRight size={16} />
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-[13px] font-semibold text-[#8aa4b4]">
              <span>3-day free trial - then $45/month</span>
              <span className="text-[#2a3a47]">|</span>
              <span>Unlimited users</span>
              <span className="text-[#2a3a47]">|</span>
              <span>196 verified tradies listed</span>
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
              Four ways to turn what you see on site into a sent, priced quote — pick whichever fits how you work.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-[#f8f9fa] rounded-3xl p-7 border border-[#e8ecef]">
              <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-4">
                <Crosshair size={20} className="text-[#ffb400]" />
              </div>
              <h3 className="font-display text-[1.4rem] text-[#0a1722] mb-2">Live on-screen quoting</h3>
              <p className="text-[14.5px] text-[#5a6a78] leading-relaxed mb-3">
                Open Swiftscope and mark straight onto your screen what material, work, or zone needs capturing.
                Press done — the materials and labour autoload into a quote with your pre-configured pricing.
                Press send. That&apos;s it.
              </p>
              <p className="text-[13px] font-bold text-[#0a1722]">Customers can accept in 30 seconds from send.</p>
            </div>

            <div className="bg-[#f8f9fa] rounded-3xl p-7 border border-[#e8ecef]">
              <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-4">
                <Mic size={20} className="text-[#ffb400]" />
              </div>
              <h3 className="font-display text-[1.4rem] text-[#0a1722] mb-2">AI voice quote generator</h3>
              <p className="text-[14.5px] text-[#5a6a78] leading-relaxed mb-3">
                Walk the site and talk to Swiftscope — describe the work and materials needed. Save, and a quote
                generates automatically using your own pricing and materials. Not your thing on site? Record it
                on the drive home instead — same result either way.
              </p>
              <p className="text-[13px] font-bold text-[#0a1722]">Customers can accept in 30 seconds from end of recording.</p>
            </div>

            <div className="bg-[#f8f9fa] rounded-3xl p-7 border border-[#e8ecef]">
              <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-4">
                <PenTool size={20} className="text-[#ffb400]" />
              </div>
              <h3 className="font-display text-[1.4rem] text-[#0a1722] mb-2">Plan &amp; drawing markup</h3>
              <p className="text-[14.5px] text-[#5a6a78] leading-relaxed mb-3">
                Upload a plan or drawing. Drop markers configured to your materials, draw lines for cable or pipe
                runs, or block out work zones. Press save — every markup syncs straight into a quote, quantities
                and costs already calculated.
              </p>
            </div>

            <div className="bg-[#f8f9fa] rounded-3xl p-7 border border-[#e8ecef]">
              <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-4">
                <FileSearch size={20} className="text-[#ffb400]" />
              </div>
              <h3 className="font-display text-[1.4rem] text-[#0a1722] mb-2">AI plan reading</h3>
              <p className="text-[14.5px] text-[#5a6a78] leading-relaxed mb-3">
                Plans can be exhaustive and time-consuming to read properly. Upload the plan, direct what needs
                reading and calculating for the job, and save straight to a quote.
              </p>
              <p className="text-[12.5px] text-[#8a9ba8] italic">* AI output should always be checked by a qualified person before sending.</p>
            </div>
          </div>

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
            <div className="text-center mt-8">
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
                Post your job once. Up to 3 matched local tradies respond with quotes.
                No lead auction. No dodgy reviews. Every tradie on Swiftscope is verified.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  "Post a job in 2 minutes",
                  "Up to 3 quotes from local tradies",
                  "Real Google ratings on every listing",
                  "Free for homeowners, always",
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-[14px] font-semibold text-[#0a1722]">
                    <CheckCircle size={16} className="text-[#ffb400] shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <Link href="/get-quotes" className="flex items-center justify-center gap-2 bg-[#0a1722] text-white font-extrabold text-[15px] py-4 rounded-xl hover:opacity-90 transition-opacity">
                Get quotes from local tradies <ArrowRight size={15} />
              </Link>
            </div>

            <div className="bg-[#0a1722] rounded-3xl p-8">
              <div className="w-12 h-12 bg-[#ffb400] rounded-2xl flex items-center justify-center mb-5">
                <Briefcase size={22} className="text-[#0a1722]" />
              </div>
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">Tradies &amp; Trade Businesses</p>
              <h3 className="font-display text-[1.8rem] text-white mb-3">Run your whole business</h3>
              <p className="text-[15px] text-[#8aa4b4] leading-relaxed mb-6">
                Quote, win, manage, and invoice jobs from your phone. Get leads from homeowners
                in your area for a flat $10/month - no auction, no per-lead cost.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  "Quote from your phone in 4 minutes on site",
                  "Homeowner leads for flat $10/month",
                  "Job management, scheduling, drawing markup",
                  "Xero live sync - no double entry",
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-[14px] font-semibold text-white">
                    <CheckCircle size={16} className="text-[#ffb400] shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <Link href="/signup" className="flex items-center justify-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] py-4 rounded-xl hover:opacity-90 transition-opacity">
                Start free trial - 3 days, no card <ArrowRight size={15} />
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
                <p className="text-[#7e94a2] text-[13px] mb-6">3-day free trial. No card needed.</p>
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
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">Directory add-on</p>
              <div className="flex items-end gap-2 mb-1">
                <span className="font-display text-[4rem] leading-none text-[#0a1722]">$10</span>
                <span className="text-[#8a9ba8] text-[16px] font-bold mb-2">/month</span>
              </div>
              <p className="text-[#8a9ba8] text-[13px] mb-6">On top of the $45 plan.</p>
              <div className="space-y-2.5 mb-8 flex-1">
                {["Listed in the public tradie directory","Homeowner quote requests in your area","Set your service suburbs and radius","No per-lead costs. Ever."].map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-[13.5px] text-[#0a1722]">
                    <CheckCircle size={14} className="text-[#ffb400] shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <Link href="/signup" className="block text-center bg-[#0a1722] text-white font-extrabold text-[15px] py-3.5 rounded-xl hover:opacity-90">
                Add to your plan
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
            <p className="text-[#8aa4b4] text-[14px] mb-6">Post your job and get up to 3 quotes from verified local tradies.</p>
            <Link href="/get-quotes" className="inline-flex items-center gap-2 bg-white text-[#0a1722] font-extrabold text-[15px] px-8 py-4 rounded-xl hover:opacity-90">
              Get quotes - it&apos;s free <ArrowRight size={15} />
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
              <Link href="/get-quotes" className="hover:text-white transition-colors">Get quotes</Link>
              <Link href="/login" className="hover:text-white transition-colors">Log in</Link>
              <Link href="/signup" className="hover:text-white transition-colors">Sign up</Link>
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
