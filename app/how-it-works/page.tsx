import Link from "next/link";
import {
  FileText, Users, Star, Zap, Briefcase, RefreshCw, ArrowRight,
} from "lucide-react";
import MarketingNav from "@/components/MarketingNav";

export const metadata = { title: "How it works — Swiftscope" };

export default function HowItWorksPage() {
  return (
    <main className="bg-white text-[#0a1722]">
      <MarketingNav />

      {/* HEADER */}
      <div className="bg-[#0a1722] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-16">
          <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">How it works</p>
          <h1 className="font-display uppercase text-[2.6rem] sm:text-[3.4rem] leading-[0.93] text-white max-w-2xl">
            Two sides. One platform.
          </h1>
          <p className="text-[16px] text-[#8aa4b4] mt-4 max-w-xl">
            Whether you&apos;re hiring a tradie or running a trade business, here&apos;s exactly what happens.
          </p>
        </div>
      </div>

      {/* HOMEOWNER STEPS */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">For homeowners</p>
            <h2 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-[#0a1722]">
              Three steps to a<br />trusted tradie
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n:"01", icon:FileText, title:"Post your job", body:"Tell us the trade, your suburb, and what needs doing. Takes 2 minutes. Budget and timeline optional." },
              { n:"02", icon:Users, title:"Get up to 3 quotes", body:"Matched local tradies claim your request and contact you directly. No bidding war. No spam. Just real tradies." },
              { n:"03", icon:Star, title:"Hire with confidence", body:"Every tradie on Swiftscope runs their business here. See their Google rating before you pick up the phone." },
            ].map(s => (
              <div key={s.n} className="bg-[#f8f9fa] rounded-2xl p-7 border border-[#e8ecef]">
                <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-4">
                  <s.icon size={20} className="text-[#ffb400]" />
                </div>
                <p className="text-[11px] font-bold tracking-[.15em] uppercase text-[#ffb400] mb-1">{s.n}</p>
                <h3 className="font-display text-[1.4rem] text-[#0a1722] mb-2">{s.title}</h3>
                <p className="text-[14px] text-[#5a6a78] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/get-quotes" className="inline-flex items-center gap-2 bg-[#0a1722] text-white font-extrabold text-[15px] px-10 py-4 rounded-xl hover:opacity-90">
              Post a job — it&apos;s free <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>

      {/* TRADIE STEPS */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">For tradies</p>
            <h2 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-[#0a1722]">
              From quote to<br />paid invoice
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n:"01", icon:Zap, title:"Quote on site", body:"Trade-specific fields calculate live as you fill them in. Send a professional quote from your phone before you've left the driveway." },
              { n:"02", icon:Briefcase, title:"Win it, run it", body:"The client accepts online. It moves straight to your job list — scheduling, materials checklist, variations, all in one place." },
              { n:"03", icon:RefreshCw, title:"Get paid", body:"Mark the job complete and it pushes straight to Xero as an invoice. No CSV export, no re-typing line items." },
            ].map(s => (
              <div key={s.n} className="bg-white rounded-2xl p-7 border border-[#e8ecef]">
                <div className="w-11 h-11 bg-[#0a1722] rounded-xl flex items-center justify-center mb-4">
                  <s.icon size={20} className="text-[#ffb400]" />
                </div>
                <p className="text-[11px] font-bold tracking-[.15em] uppercase text-[#ffb400] mb-1">{s.n}</p>
                <h3 className="font-display text-[1.4rem] text-[#0a1722] mb-2">{s.title}</h3>
                <p className="text-[14px] text-[#5a6a78] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/signup" className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-10 py-4 rounded-xl hover:opacity-90">
              Start free trial <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="bg-[#0a1722]">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <h3 className="font-display text-[1.8rem] sm:text-[2.2rem] text-white mb-3">Want the full feature list?</h3>
          <Link href="/features" className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-8 py-4 rounded-xl hover:opacity-90">
            See all features <ArrowRight size={15} />
          </Link>
        </div>
        <div className="border-t border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-lg text-white">SWIFTSCOPE</span>
            <div className="flex gap-6 text-[12.5px] font-semibold text-white/40">
              <Link href="/features" className="hover:text-white transition-colors">Features</Link>
              <Link href="/directory" className="hover:text-white transition-colors">Directory</Link>
              <Link href="/login" className="hover:text-white transition-colors">Log in</Link>
              <Link href="/signup" className="hover:text-white transition-colors">Sign up</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
