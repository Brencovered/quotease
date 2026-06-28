import Link from "next/link";
import Image from "next/image";

const HERO_IMG = "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=1800&q=85&auto=format&fit=crop";
const SITE_IMG = "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&q=85&auto=format&fit=crop";

const FEATURES = [
  { n: "01", title: "Quote in 4 minutes on site",         body: "Trade-specific fields built around what you see on the job. Fill in what is in front of you and the number calculates live as you go." },
  { n: "02", title: "Send before you leave the driveway", body: "Hit send from your phone. The client gets a professional branded quote in their inbox while you are still on site." },
  { n: "03", title: "Client accepts and pays online",      body: "One tap to accept, tick the terms, choose how to pay - bank transfer, cash or card. No back-and-forth. No paperwork." },
  { n: "04", title: "Quote becomes a job automatically",   body: "Accepted quotes flip to jobs. Schedule the start date, upload drawings, track materials and log actuals against what you quoted." },
  { n: "05", title: "Know if you made money",              body: "Job costing tracks actual hours and materials vs what you quoted. See your real margin on every job, not just revenue." },
  { n: "06", title: "Variations in writing, always",       body: "Client wants to add scope mid-job? Raise a variation order in one tap. Gets signed off before you touch it." },
  { n: "07", title: "Mark up plans and drawings",          body: "Upload a site plan, draw cable runs, pipe routes, areas or count items directly on the drawing. Costs feed into the quote automatically." },
  { n: "08", title: "Follow-up reminders built in",        body: "Quotes going quiet? Automatic follow-up reminders so nothing falls through the cracks while you are on the tools." },
];

const TRADES = [
  { name: "Electricians",     detail: "Powerpoints, switchboards, downlights, solar, certs" },
  { name: "Plumbers",         detail: "Tapware, hot water, rough-ins, gas fitting, drainage" },
  { name: "Carpenters",       detail: "Framing, doors, decking, fitout, skirting" },
  { name: "Roofers",          detail: "Colorbond, terracotta, gutters, skylights, scaffold" },
  { name: "Painters",         detail: "Interior, exterior, prep, feature walls, trim" },
  { name: "Tilers",           detail: "Floor, wall, wet areas, outdoor, grouting" },
  { name: "Landscapers",      detail: "Retaining walls, paving, turf, irrigation" },
  { name: "Arborists",        detail: "Tree removal, pruning, stump grinding, reports" },
  { name: "Concreters",       detail: "Slabs, driveways, pathways, exposed aggregate" },
  { name: "Fencers",          detail: "Colorbond, timber, retaining, pool fencing" },
  { name: "Air conditioning",  detail: "Split systems, ducted, service, compliance" },
  { name: "Surveyors",        detail: "Feature, boundary, construction, peg out" },
];

const PAIN_POINTS = [
  { x: "Quoting on a Word doc at 10pm",          y: "Built in 4 min on your phone, on site" },
  { x: "Losing jobs to whoever quoted first",     y: "Send before you reverse out of the driveway" },
  { x: "Scope creep with nothing in writing",     y: "Variation orders signed off before you start" },
  { x: "No idea if the job actually made money",  y: "Job costing - actual vs quoted, every time" },
  { x: "Chasing invoices for weeks",              y: "Client accepts and pays online, same day" },
];

export default function Home() {
  return (
    <main className="bg-white text-[#0a1722] overflow-hidden">

      {/* NAV */}
      <div className="absolute top-0 left-0 right-0 z-30 max-w-7xl mx-auto px-6 pt-6 flex items-center justify-between">
        <span className="font-display text-xl tracking-wide text-white drop-shadow-lg">SWIFTSCOPE</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-white/80 hover:text-white font-semibold text-sm transition-colors hidden sm:block drop-shadow">Log in</Link>
          <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-sm px-5 py-2.5 rounded-xl hover:bg-[#e89e00] transition-colors">
            Sign up free
          </Link>
        </div>
      </div>

      {/* HERO */}
      <div className="relative h-screen min-h-[700px] max-h-[960px] flex items-end bg-[#0a1722]">
        <div className="absolute inset-0 z-0">
          <Image src={HERO_IMG} alt="Electrician working on residential switchboard" fill className="object-cover object-center" priority unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1722] via-[#0a1722]/50 to-[#0a1722]/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1722]/70 to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-24 w-full">
          <div className="max-w-[680px]">
            <h1 className="font-display uppercase leading-[0.88] mb-8">
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[6rem] text-white">Quote it.</span>
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[6rem] text-white">Send it.</span>
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[6rem] text-[#ffb400]">Win the job.</span>
            </h1>
            <p className="text-[17px] sm:text-[18px] leading-[1.65] text-[#c8d8e4] max-w-[540px] mb-10">
              Swiftscope is quoting and job management built for residential tradies.
              Get a professional quote built and sent from your phone before you leave the driveway -
              while the other tradie is still working out their price.
            </p>
            <div className="flex flex-wrap gap-4 mb-8">
              <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[16px] px-8 py-4 rounded-xl hover:bg-[#e89e00] transition-colors" style={{ boxShadow: "0 12px 32px rgba(255,180,0,.3)" }}>
                Sign up free - no card needed
              </Link>
              <Link href="/login" className="text-white font-bold text-[16px] px-6 py-4 rounded-xl border border-white/25 hover:border-white/50 transition-colors">
                Log in
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-[13px] font-semibold text-[#8aa4b4]">
              <span>Free during early access</span>
              <span className="text-[#2a3a47]">|</span>
              <span>Unlimited users</span>
              <span className="text-[#2a3a47]">|</span>
              <span>Works for any trade</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 opacity-40">
          <span className="text-[11px] font-bold tracking-[.2em] uppercase text-white">Scroll</span>
          <div className="w-px h-8 bg-white/40" />
        </div>
      </div>

      {/* TRADES STRIP */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] pt-8 pb-4">Works for every trade</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 divide-x divide-y divide-[#e8ecef]">
            {TRADES.map((t, i) => (
              <div key={t.name} className="px-5 py-5">
                <p className="text-[10px] font-bold tracking-[.14em] uppercase text-[#ffb400] mb-1.5">{String(i + 1).padStart(2, "0")}</p>
                <p className="font-extrabold text-[#0a1722] text-[14px] mb-1">{t.name}</p>
                <p className="text-[11.5px] text-[#8a9ba8] leading-snug">{t.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-[1fr_2fr] gap-16 items-start">
            <div className="lg:sticky lg:top-24">
              <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Everything in one place</span>
              <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.93] mt-3 mb-6 text-[#0a1722]">
                From first call<br />to final payment.
              </h2>
              <p className="text-[15px] text-[#5a7080] leading-[1.7] mb-8">
                Most quoting tools stop at the quote. Swiftscope covers the whole job -
                from the first number on site to the final payment cleared.
              </p>
              <Link href="/signup" className="inline-flex bg-[#0a1722] text-white font-extrabold text-[15px] px-6 py-3.5 rounded-xl hover:bg-[#0e2233] transition-colors">
                Sign up free
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {FEATURES.map((f) => (
                <div key={f.n} className="bg-[#f8f9fa] border border-[#e8ecef] rounded-2xl p-7 hover:border-[#ffb400] hover:bg-white transition-all">
                  <p className="font-display text-[1.6rem] leading-none mb-5 text-[#ffb400]">{f.n}</p>
                  <h3 className="font-extrabold text-[15px] text-[#0a1722] mb-2 leading-snug">{f.title}</h3>
                  <p className="text-[13px] text-[#5a7080] leading-[1.65]">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PHOTO BREAK */}
      <div className="relative h-[55vh] min-h-[380px] overflow-hidden">
        <Image src={SITE_IMG} alt="Tradies on a residential job site" fill className="object-cover object-center" unoptimized />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a1722]/95 via-[#0a1722]/70 to-[#0a1722]/20" />
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-6">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-4">The problem we solved</p>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[3.2rem] leading-[0.93] text-white max-w-[540px] mb-5">
              54% of clients go with<br />the first quote they get.
            </h2>
            <p className="text-[16px] text-[#a9bcc8] max-w-[420px] leading-[1.6]">
              Speed wins the job. Swiftscope gets you there first - every time, from every site.
            </p>
          </div>
        </div>
      </div>

      {/* PROBLEM / FIX */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="mb-12">
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Sound familiar?</span>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.93] mt-3 text-[#0a1722]">
              Every problem.<br />Already fixed.
            </h2>
          </div>
          <div className="flex flex-col divide-y divide-[#e8ecef]">
            {PAIN_POINTS.map((p, i) => (
              <div key={i} className="grid sm:grid-cols-[1fr_1fr] py-5 items-center gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-[11px] font-bold text-[#c8d4da] tabular w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[15px] text-[#8a9ba8] font-semibold line-through decoration-[#c8d4da]">{p.x}</span>
                </div>
                <div className="flex items-center gap-4 sm:border-l border-[#e8ecef] sm:pl-8">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ffb400] shrink-0" />
                  <span className="text-[15px] text-[#0a1722] font-semibold">{p.y}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WHY SWIFTSCOPE EXISTS - Nick's story, no Spark Ease business name */}
      <div className="bg-[#f8f9fa] border-t border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative rounded-2xl overflow-hidden aspect-[4/3] order-2 lg:order-1 shadow-lg">
            <Image
              src="https://images.squarespace-cdn.com/content/v1/6848e6851124a2687a93a35f/ea135f61-ba35-4cdd-a281-ffcab6e07c5e/residential-electrician-melbourne-lounge+room.jpg"
              alt="High-spec residential electrical install, Melbourne"
              fill className="object-cover" unoptimized
            />
          </div>
          <div className="order-1 lg:order-2">
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Why it exists</span>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.93] mt-3 mb-6 text-[#0a1722]">
              Built by someone who<br />actually does the work.
            </h2>
            <p className="text-[15.5px] text-[#3a5060] leading-[1.7] mb-5">
              Nick has been running a residential electrical business across Melbourne since 2013.
              Bayside, Mornington Peninsula, inner suburbs. High-spec builds, renovations, commercial fitouts.
            </p>
            <p className="text-[15.5px] text-[#3a5060] leading-[1.7] mb-8">
              He built Swiftscope because every tool he tried was either designed by someone who
              had never held a cable puller, or so bloated it took three weeks to set up.
              Swiftscope does exactly what a tradie actually needs. Nothing more.
            </p>
            <div className="flex items-center gap-4 p-4 bg-white border border-[#e8ecef] rounded-2xl shadow-sm">
              <div className="w-12 h-12 rounded-full bg-[#0a1722] flex items-center justify-center font-display text-xl text-[#ffb400] shrink-0">N</div>
              <div>
                <p className="font-bold text-[#0a1722] text-[14px]">Nick</p>
                <p className="text-[12.5px] text-[#5a7080]">Licensed electrician, Melbourne</p>
                <p className="text-[12px] text-[#8a9ba8]">REC 23538 - in the trade since 2013</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PLATFORM CONSOLIDATION */}
      <div className="bg-[#f8f9fa] border-t border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="mb-12">
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Platform overload</span>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.93] mt-3 text-[#0a1722]">
              How many tools are you<br />paying for right now?
            </h2>
            <p className="text-[15px] text-[#5a7080] leading-[1.7] mt-4 max-w-[540px]">
              The average sole trader runs four separate platforms before they send their first invoice.
              Each one costs money. None of them talk to each other. Swiftscope consolidates the ones that matter.
            </p>
          </div>

          {/* Stack comparison */}
          <div className="grid lg:grid-cols-2 gap-8 items-start">

            {/* Before */}
            <div>
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#8a9ba8] mb-4">What most tradies run today</p>
              <div className="space-y-2">
                {[
                  { tool: "Word or Excel",          use: "Writing up quotes",                cost: "Free but slow",       replaced: true },
                  { tool: "Fergus / ServiceM8",      use: "Job management",                  cost: "$40-60/mo",           replaced: true },
                  { tool: "GroundPlan / PlanSwift",  use: "Drawing takeoffs and markup",     cost: "$60-100/mo",          replaced: true },
                  { tool: "Google Calendar",         use: "Scheduling jobs",                 cost: "Free",                replaced: true },
                  { tool: "Xero / MYOB",             use: "Invoicing and accounting",        cost: "$30-50/mo",           replaced: false },
                  { tool: "WhatsApp / Email",        use: "Client communication",            cost: "Free",                replaced: false },
                ].map((r) => (
                  <div key={r.tool} className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border transition-all ${
                    r.replaced
                      ? "bg-red-50/60 border-red-100 opacity-70"
                      : "bg-white border-[#e8ecef]"
                  }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                      r.replaced ? "bg-red-100 text-red-400" : "bg-[#e8ecef] text-[#8a9ba8]"
                    }`}>
                      {r.replaced ? "×" : "·"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-[14px] ${r.replaced ? "line-through text-[#8a9ba8]" : "text-[#0a1722]"}`}>{r.tool}</p>
                      <p className="text-[12px] text-[#8a9ba8]">{r.use}</p>
                    </div>
                    <span className={`text-[12px] font-semibold shrink-0 ${r.replaced ? "text-red-400" : "text-[#8a9ba8]"}`}>{r.cost}</span>
                  </div>
                ))}
              </div>
              <p className="text-[12.5px] text-[#8a9ba8] mt-3 font-semibold">
                Up to $200/month. Four logins. Nothing connected.
              </p>
            </div>

            {/* After */}
            <div>
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-4">What you need with Swiftscope</p>
              <div className="space-y-2">
                {[
                  { tool: "Swiftscope",   use: "Quote, job management, drawings, schedule", highlight: true },
                  { tool: "Xero / MYOB",  use: "Accounting — export from Swiftscope in one click", highlight: false },
                ].map((r) => (
                  <div key={r.tool} className={`flex items-center gap-4 px-5 py-4 rounded-xl border ${
                    r.highlight
                      ? "bg-[#0a1722] border-[#0a1722]"
                      : "bg-white border-[#e8ecef]"
                  }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                      r.highlight ? "bg-[#ffb400] text-[#0a1722]" : "bg-[#e8ecef] text-[#8a9ba8]"
                    }`}>
                      {r.highlight ? "✓" : "·"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-[14px] ${r.highlight ? "text-white" : "text-[#0a1722]"}`}>{r.tool}</p>
                      <p className={`text-[12px] ${r.highlight ? "text-[#7e94a2]" : "text-[#8a9ba8]"}`}>{r.use}</p>
                    </div>
                    {r.highlight && (
                      <span className="text-[12px] font-bold text-[#ffb400] shrink-0">Free now</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Savings callout */}
              <div className="mt-6 bg-[#0a1722] rounded-2xl p-6">
                <div className="grid grid-cols-3 gap-4 mb-5">
                  {[
                    { n: "3-4",    label: "Platforms replaced" },
                    { n: "$150+",  label: "Monthly saving" },
                    { n: "1",      label: "Login to remember" },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="font-display text-[2rem] leading-tight text-[#ffb400]">{s.n}</p>
                      <p className="text-[11px] text-[#4a6070] font-semibold mt-1 leading-snug">{s.label}</p>
                    </div>
                  ))}
                </div>
                <a href="/signup" className="block text-center bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] py-3.5 rounded-xl hover:bg-[#e89e00] transition-colors">
                  Replace the stack for free
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VS COMPETITORS */}
      <div className="bg-white border-t border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="mb-12">
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Why not just use Fergus?</span>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.93] mt-3 text-[#0a1722]">
              Built for a crew of 20.<br />You have got a ute.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Setup time", them: "3 weeks",         us: "Day one" },
              { label: "Built for",  them: "Teams of 10+",    us: "Sole traders" },
              { label: "Price",      them: "$40+/user/month", us: "Free right now" },
              { label: "Scope",      them: "HR, SWMS, POs",   us: "Quote. Job. Paid." },
            ].map((r) => (
              <div key={r.label} className="bg-[#f8f9fa] border border-[#e8ecef] rounded-2xl p-6">
                <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#ffb400] mb-4">{r.label}</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-[10px] text-red-500 font-bold shrink-0">x</span>
                    <span className="text-[13px] text-[#8a9ba8]">{r.them}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#ffb400]/15 flex items-center justify-center text-[10px] text-[#e89e00] font-bold shrink-0">v</span>
                    <span className="text-[13px] text-[#0a1722] font-semibold">{r.us}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div className="bg-[#f8f9fa] border-t border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Pricing</span>
            <h2 className="font-display uppercase text-[2.5rem] sm:text-[3.2rem] leading-[0.93] mt-3 mb-8 text-[#0a1722]">
              Free right now.<br />No catch.
            </h2>
            <div className="flex flex-col divide-y divide-[#e8ecef]">
              {[
                "Free during early access - no credit card, ever",
                "Unlimited users, unlimited quotes",
                "Works for any trade",
                "Mark up drawings and link to quotes",
                "Xero CSV export included",
                "We will ask for your feedback as we build",
              ].map((f) => (
                <div key={f} className="flex items-center gap-3 py-3.5 text-[14.5px] text-[#0a1722] font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ffb400] shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#0a1722] rounded-3xl overflow-hidden shadow-2xl">
            <div className="h-3" style={{ background: "repeating-linear-gradient(135deg,#FFB400 0 14px,#E89E00 14px 28px)" }} />
            <div className="p-10 text-center">
              <p className="text-[12px] font-bold tracking-[.2em] uppercase text-[#7e94a2] mb-4">Early access</p>
              <div className="flex items-end justify-center gap-2 mb-3">
                <span className="font-display text-[6rem] leading-[0.85] text-[#ffb400]">$0</span>
              </div>
              <p className="text-[#7e94a2] text-[14px] mb-1">free while we are building this out</p>
              <p className="text-[12px] text-[#3a4f5e] mb-8">In exchange we will ask for your feedback and hope to earn a testimonial along the way.</p>
              <Link href="/signup" className="block bg-[#ffb400] text-[#0a1722] font-extrabold text-[17px] py-4 rounded-xl mb-3 hover:bg-[#e89e00] transition-colors">
                Sign up free
              </Link>
              <Link href="/login" className="block text-[#7e94a2] text-[14px] hover:text-white transition-colors">
                Already have an account? Log in
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER CTA */}
      <div className="bg-[#0a1722]">
        <div className="max-w-7xl mx-auto px-6 py-20 grid sm:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <h2 className="font-display uppercase text-[2.8rem] sm:text-[3.5rem] leading-[0.92] mb-3 text-white">
              The other tradie just<br />sent their quote.
            </h2>
            <p className="font-bold text-[16px] text-white/50">How long does yours take?</p>
          </div>
          <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[17px] px-10 py-5 rounded-xl hover:bg-[#e89e00] transition-colors whitespace-nowrap">
            Start quoting today
          </Link>
        </div>
        <div className="border-t border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-lg text-white">SWIFTSCOPE</span>
            <div className="flex gap-6 text-[12.5px] font-semibold text-white/40">
              <Link href="/login" className="hover:text-white transition-colors">Log in</Link>
              <Link href="/signup" className="hover:text-white transition-colors">Sign up</Link>
            </div>
          </div>
        </div>
      </div>

    </main>
  );
}
