import Link from "next/link";
import Image from "next/image";
import {
  Home as HomeIcon, Briefcase, CheckCircle, ArrowRight,
} from "lucide-react";
import MarketingNav from "@/components/MarketingNav";

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
              <span className="text-[12px] font-bold text-white/80 uppercase tracking-widest">Australia&apos;s trade platform</span>
            </div>
            <h1 className="font-display uppercase leading-[0.88] mb-6">
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[5.5rem] text-white">One platform.</span>
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[5.5rem] text-white">Every tradie.</span>
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[5.5rem] text-[#ffb400]">Every job.</span>
            </h1>
            <p className="text-[17px] sm:text-[18px] leading-[1.65] text-[#c8d8e4] max-w-[560px] mb-10">
              Where homeowners find trusted local tradies - and tradies run their entire business,
              for one flat $45/month.
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

    </main>
  );
}
