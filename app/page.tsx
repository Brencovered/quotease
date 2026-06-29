import Link from "next/link";
import Image from "next/image";
import {
  Zap, Users, Smartphone, FileText, DollarSign, PenTool,
  Calendar, RefreshCw, MapPin, Star, CheckCircle, ArrowRight,
  Briefcase, Home as HomeIcon, ChevronDown,
} from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=1800&q=85&auto=format&fit=crop";

// ── Expandable comparison row ──────────────────────────────────────────────
// This is a client component -- we'll inline the toggle with a details/summary
// since this is a server component page. No JS needed, native HTML.

export default function Home() {
  return (
    <main className="bg-white text-[#0a1722] overflow-hidden">

      {/* NAV */}
      <div className="absolute top-0 left-0 right-0 z-30 max-w-7xl mx-auto px-6 pt-6 flex items-center justify-between">
        <span className="font-display text-xl tracking-wide text-white drop-shadow-lg">SWIFTSCOPE</span>
        <div className="flex items-center gap-5">
          <Link href="/directory" className="text-white/80 hover:text-white font-semibold text-sm transition-colors hidden sm:block drop-shadow">Find a tradie</Link>
          <Link href="/get-quotes" className="text-white/80 hover:text-white font-semibold text-sm transition-colors hidden sm:block drop-shadow">Get quotes</Link>
          <Link href="/login" className="text-white/80 hover:text-white font-semibold text-sm transition-colors hidden sm:block drop-shadow">Log in</Link>
          <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-sm px-5 py-2.5 rounded-xl hover:bg-[#e89e00] transition-colors">
            Sign up free
          </Link>
        </div>
      </div>

      {/* HERO */}
      <div className="relative h-screen min-h-[700px] max-h-[960px] flex items-end bg-[#0a1722]">
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
              Where homeowners find trusted local tradies — and tradies run their entire business.
              Replace HiPages leads, Fergus job management, and GroundPlan drawings for one flat $45/month.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[16px] px-8 py-4 rounded-xl hover:bg-[#e89e00] transition-colors" style={{ boxShadow:"0 12px 32px rgba(255,180,0,.3)" }}>
                I&apos;m a tradie — start free
              </Link>
              <Link href="/get-quotes" className="text-white font-bold text-[16px] px-6 py-4 rounded-xl border border-white/25 hover:border-white/50 transition-colors flex items-center gap-2">
                I need a tradie <ArrowRight size={16} />
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-[13px] font-semibold text-[#8aa4b4]">
              <span>3-day free trial — then $45/month</span>
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
                  "All 13 trades covered",
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
                in your area for a flat $10/month — no auction, no per-lead cost.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  "Quote from your phone in 4 minutes on site",
                  "Homeowner leads for flat $10/month",
                  "Job management, scheduling, variations",
                  "Xero live sync — no double entry",
                  "Drawing markup linked to quotes",
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-[14px] font-semibold text-white">
                    <CheckCircle size={16} className="text-[#ffb400] shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <Link href="/signup" className="flex items-center justify-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] py-4 rounded-xl hover:opacity-90 transition-opacity">
                Start free trial — 3 days, no card <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS -- HOMEOWNER */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
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
            <Link href="/get-quotes" className="inline-flex items-center gap-2 bg-[#0a1722] text-white font-extrabold text-[15px] px-10 py-4 rounded-xl hover:opacity-90">
              Post a job — it&apos;s free <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>

      {/* REPLACES + INTEGRATES */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">For tradies</p>
            <h2 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-[#0a1722]">
              Replace some tools.<br />Integrate with others.
            </h2>
            <p className="text-[16px] text-[#5a6a78] mt-4 max-w-xl mx-auto">
              Most tradies run 3-4 separate tools. Swiftscope consolidates what makes sense —
              and connects cleanly to tools like Xero that you should keep.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {[
              { icon:MapPin,      type:"replace",   replaces:"HiPages",          label:"Lead generation",      note:"Homeowner quote requests for a flat $10/month. No per-lead auction. No credits system." },
              { icon:Briefcase,   type:"replace",   replaces:"Fergus / Tradify", label:"Job management",       note:"Quotes, jobs, scheduling, variations, job costing. All in one place, all on your phone." },
              { icon:Smartphone,  type:"replace",   replaces:"ServiceM8",        label:"Mobile quoting",       note:"Trade-specific quote builder on your phone. Send the quote before you leave the driveway." },
              { icon:PenTool,     type:"replace",   replaces:"GroundPlan",       label:"Drawing markup",       note:"Upload site plans, draw cable runs or pipe routes, count items. Costs link to your quote." },
              { icon:DollarSign,  type:"replace",   replaces:"SimPro",           label:"Job costing",          note:"Track actual hours and materials against what you quoted. Know your real margin on every job." },
              { icon:RefreshCw,   type:"integrate", replaces:"Xero",             label:"Xero live sync",       note:"Swiftscope integrates with Xero. Accepted quotes push as invoices automatically — no double entry." },
            ].map(r => (
              <div key={r.replaces} className={`rounded-2xl p-6 border ${r.type === "integrate" ? "bg-blue-50 border-blue-100" : "bg-[#f8f9fa] border-[#e8ecef]"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.type === "integrate" ? "bg-blue-100" : "bg-[#0a1722]"}`}>
                    <r.icon size={18} className={r.type === "integrate" ? "text-blue-600" : "text-[#ffb400]"} />
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                    r.type === "integrate"
                      ? "bg-blue-100 text-blue-700 border-blue-200"
                      : "bg-red-50 text-red-600 border-red-100"
                  }`}>
                    {r.type === "integrate" ? `Integrates with ${r.replaces}` : `Replaces ${r.replaces}`}
                  </span>
                </div>
                <p className="font-bold text-[15px] text-[#0a1722] mb-1">{r.label}</p>
                <p className="text-[13px] text-[#5a6a78] leading-relaxed">{r.note}</p>
              </div>
            ))}
          </div>

          {/* Cost comparison */}
          <div className="bg-[#0a1722] rounded-3xl p-8 md:p-10">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="font-display text-[2rem] text-white mb-2">What you might be paying now</h3>
                <p className="text-[#8aa4b4] text-[14px] mb-6">Approximate costs for a typical sole trader or small trade business.</p>
                <div className="space-y-2">
                  {[
                    ["HiPages lead credits",      "$80–300/month"],
                    ["Fergus or ServiceM8",        "$40–130/month"],
                    ["GroundPlan (drawings)",       "$60–100/month"],
                  ].map(([tool, cost]) => (
                    <div key={tool} className="flex items-center justify-between py-2 border-b border-white/[0.07]">
                      <span className="text-[14px] text-[#8aa4b4]">{tool}</span>
                      <span className="text-[14px] font-bold text-white/50 line-through">{cost}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-[15px] font-bold text-white">Subtotal</span>
                    <span className="text-[15px] font-bold text-red-400 line-through">$180–530/month</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/[0.05] rounded-2xl p-7 text-center border border-white/10">
                <p className="text-[12px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Swiftscope</p>
                <div className="font-display text-[5rem] leading-none text-[#ffb400] mb-1">$45</div>
                <p className="text-[#8aa4b4] text-[16px] mb-1">/month</p>
                <p className="text-[13px] text-[#4a6070] mb-6">Everything included. Unlimited seats.<br/>Xero integration included.</p>
                <Link href="/signup" className="block bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] py-3.5 rounded-xl hover:opacity-90">
                  Start free trial
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TRADIE FEATURES */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Features</p>
            <h2 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-[#0a1722]">
              Everything a tradie<br />actually needs
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon:Zap,       title:"Quote in 4 minutes",   body:"Trade-specific fields. Numbers calculate live as you fill them in. Send a professional quote from your phone before you leave the driveway." },
              { icon:MapPin,    title:"Win local leads",      body:"Homeowners in your area post jobs. You claim them for a flat $10/month directory fee. No auction. No credits. No per-lead cost." },
              { icon:PenTool,   title:"Mark up drawings",     body:"Upload site plans. Draw cable runs, pipe routes, or areas. Count items directly on the plan. All costs feed into your quote automatically." },
              { icon:DollarSign,title:"Know your margin",     body:"Job costing tracks actual hours and materials against what you quoted. See exactly where you made or lost money on every single job." },
              { icon:FileText,  title:"Variations in writing",body:"Scope creep kills margins. Raise a variation order in one tap. It gets signed off before you touch a single extra item." },
              { icon:RefreshCw, title:"Xero live sync",       body:"Swiftscope integrates directly with Xero. Accepted quotes push as invoices automatically. No CSV export. No manual re-entry." },
              { icon:Calendar,  title:"Schedule and track",   body:"Calendar view for all jobs. Drag to reschedule. Materials checklist seeded from the quote scope. Everything in one place." },
              { icon:Users,     title:"Unlimited team",       body:"Add apprentices, office staff, or business partners. No per-user fees. Everyone on the same job at the same time." },
            ].map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-[#e8ecef]">
                <div className="w-10 h-10 bg-[#0a1722] rounded-xl flex items-center justify-center mb-3">
                  <f.icon size={18} className="text-[#ffb400]" />
                </div>
                <h3 className="font-bold text-[15px] text-[#0a1722] mb-1.5">{f.title}</h3>
                <p className="text-[13px] text-[#5a6a78] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TRADES */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-4 text-center">13 trades supported</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {["Electricians","Plumbers","Builders","Roofers","Painters","Carpenters","Tilers","Landscapers","Arborists","Concreters","Fencers","Air conditioning","Surveyors"].map(t => (
              <span key={t} className="px-4 py-2 bg-[#f8f9fa] border border-[#e8ecef] rounded-full text-[13.5px] font-semibold text-[#0a1722]">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* COMPETITOR TABLE -- expandable rows */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Comparison</p>
            <h2 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-[#0a1722]">
              How we compare
            </h2>
            <p className="text-[14px] text-[#8a9ba8] mt-3">Click any row to see more detail</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b-2 border-[#e8ecef]">
                  <th className="pb-4 pr-4 text-left text-[12px] font-bold uppercase tracking-wider text-[#8a9ba8] w-[26%]">Feature</th>
                  {[
                    { name:"Swiftscope", highlight:true },
                    { name:"HiPages",   highlight:false },
                    { name:"Fergus",    highlight:false },
                    { name:"ServiceM8", highlight:false },
                    { name:"Tradify",   highlight:false },
                    { name:"SimPro",    highlight:false },
                  ].map(c => (
                    <th key={c.name} className={`pb-4 px-3 text-center text-[12px] font-extrabold ${c.highlight ? "text-[#0a1722]" : "text-[#8a9ba8]"}`}>
                      {c.highlight ? (
                        <span className="inline-flex flex-col items-center gap-1">
                          {c.name}
                          <span className="text-[9px] bg-[#ffb400] text-[#0a1722] px-2 py-0.5 rounded-full font-bold uppercase">Us</span>
                        </span>
                      ) : c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    feature:"Lead generation",
                    detail:"Swiftscope connects homeowners directly to tradies via the directory and quote request system. You pay $10/month flat — no auction, no credits, no per-lead cost. HiPages charges $30–150 per lead depending on trade and urgency.",
                    us:"$10/mo flat",    c1:"$30–150/lead",    c2:"Not included",    c3:"Not included",  c4:"Not included",  c5:"Not included", usBest:true,
                  },
                  {
                    feature:"Job management",
                    detail:"Swiftscope covers the full job lifecycle: quote, accept, schedule, track materials, log actuals, raise variations, complete. Fergus and SimPro have more enterprise depth but cost significantly more per user.",
                    us:"Included",       c1:"Not included",    c2:"Full suite",      c3:"Full suite",    c4:"Full suite",    c5:"Enterprise",   usBest:false,
                  },
                  {
                    feature:"Mobile quoting",
                    detail:"Swiftscope is built phone-first. Trade-specific fields, live cost calculation, send from site. All major platforms support mobile quoting — this is table stakes.",
                    us:"Phone-first",    c1:"Not included",    c2:"Yes",             c3:"Yes",           c4:"Yes",           c5:"Limited",      usBest:false,
                  },
                  {
                    feature:"Drawing markup",
                    detail:"Swiftscope includes drawing markup natively — upload a site plan, draw cable runs or pipe routes, count items, and those quantities flow directly into the quote. Fergus requires GroundPlan as a separate integration at $60–100/month extra.",
                    us:"Built in",       c1:"Not included",    c2:"Extra ($60–100/mo)", c3:"Basic photos", c4:"Not available", c5:"Basic",       usBest:true,
                  },
                  {
                    feature:"Xero integration",
                    detail:"Swiftscope integrates with Xero via live OAuth sync. Accepted quotes push as invoices automatically. All platforms listed offer some form of Xero integration — Swiftscope's is included in the base plan.",
                    us:"Live sync",      c1:"Not applicable",  c2:"Live sync",       c3:"Live sync",     c4:"Live sync",     c5:"Live sync",    usBest:false,
                  },
                  {
                    feature:"Job costing",
                    detail:"Track actual labour hours and materials against what you quoted. Swiftscope shows your real margin on every job. Fergus, Tradify, and SimPro all have job costing — this is where they are more mature than Swiftscope currently.",
                    us:"Included",       c1:"Not included",    c2:"Yes",             c3:"Add-on",        c4:"Yes",           c5:"Advanced",     usBest:false,
                  },
                  {
                    feature:"Homeowner directory",
                    detail:"Swiftscope includes a public tradie directory with real Google ratings, photo galleries, and a quote request system — built into the same platform tradies use to run their business. HiPages has a larger network, but tradies on Swiftscope are active users of the platform, not just passive listings.",
                    us:"Verified + active", c1:"Large network", c2:"Not included", c3:"Not included", c4:"Not included", c5:"Not included", usBest:false,
                  },
                  {
                    feature:"Pricing",
                    detail:"Swiftscope is $45/month flat for the full platform — unlimited seats, unlimited quotes, unlimited jobs. The directory add-on (leads) is $10/month extra. Per-user pricing at competitors means costs scale steeply as you add staff.",
                    us:"$45/mo flat",    c1:"$80–300/mo + leads", c2:"~$40/user/mo", c3:"$29–349/mo",   c4:"$48–62/user/mo", c5:"$75+/user/mo", usBest:true,
                  },
                  {
                    feature:"Unlimited users",
                    detail:"Swiftscope has no per-user fees. Add apprentices, office staff, or business partners at no extra cost. Fergus, Tradify, and SimPro all charge per user which can double or triple the cost for larger teams.",
                    us:"Always",         c1:"N/A",             c2:"Per user",        c3:"Yes",           c4:"Per user",      c5:"Per user",     usBest:true,
                  },
                  {
                    feature:"Setup time",
                    detail:"Swiftscope is designed to have you quoting on the same day you sign up. No implementation project, no onboarding consultant. SimPro and Fergus often require days to weeks of configuration for larger businesses.",
                    us:"Same day",       c1:"Same day",        c2:"Days to weeks",   c3:"1–2 days",      c4:"Half day",      c5:"Weeks",        usBest:true,
                  },
                ].map((row) => (
                  <tr key={row.feature} className="group">
                    <td colSpan={7} className="p-0">
                      <details className="w-full">
                        <summary className="list-none cursor-pointer">
                          <table className="w-full">
                            <tbody>
                              <tr className="hover:bg-[#fffdf5] border-b border-[#f0f2f4] transition-colors">
                                <td className="py-3.5 pr-4 w-[26%]">
                                  <div className="flex items-center gap-2">
                                    <ChevronDown size={13} className="text-[#8a9ba8] shrink-0 details-open:rotate-180 transition-transform" />
                                    <span className="text-[13.5px] font-semibold text-[#0a1722]">{row.feature}</span>
                                  </div>
                                </td>
                                <td className={`py-3.5 px-3 text-center w-[12.5%] ${row.usBest ? "bg-[#fffbf0]" : ""}`}>
                                  <span className={`text-[12.5px] font-bold ${row.usBest ? "text-[#e89e00]" : "text-[#0a1722]"}`}>{row.us}</span>
                                </td>
                                {[row.c1, row.c2, row.c3, row.c4, row.c5].map((val, i) => (
                                  <td key={i} className="py-3.5 px-3 text-center w-[12.5%]">
                                    <span className="text-[12px] text-[#8a9ba8]">{val}</span>
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </summary>
                        <div className="bg-[#fffbf0] border-b border-[#ffe8a0] px-6 py-4">
                          <p className="text-[13.5px] text-[#5a4a00] leading-relaxed max-w-3xl">{row.detail}</p>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11.5px] text-[#b0bec5] mt-6">Pricing sourced from vendor websites, June 2026. AUD. Estimates based on typical sole trader or small team usage.</p>
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
                {["Listed in the public tradie directory","Homeowner quote requests in your area","Set your service suburbs and radius","Choose lead types (early, warm, hot)","No per-lead costs. Ever."].map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-[13.5px] text-[#0a1722]">
                    <CheckCircle size={14} className="text-[#ffb400] shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <Link href="/signup" className="block text-center bg-[#0a1722] text-white font-extrabold text-[15px] py-3.5 rounded-xl hover:opacity-90">
                Add to your plan
              </Link>
              <p className="text-[12px] text-[#8a9ba8] text-center mt-3">Free for homeowners — always</p>
            </div>
          </div>
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
              Get quotes — it&apos;s free <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <div className="border-t border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-lg text-white">SWIFTSCOPE</span>
            <div className="flex gap-6 text-[12.5px] font-semibold text-white/40">
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
