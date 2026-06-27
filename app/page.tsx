import Link from "next/link";
import Image from "next/image";

// High quality Unsplash images — reliable CDN, no auth needed
const HERO_IMG    = "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=1800&q=85&auto=format&fit=crop";  // electrician working on switchboard
const SITE_IMG    = "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&q=85&auto=format&fit=crop";  // tradie on site construction
const PHONE_IMG   = "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1400&q=85&auto=format&fit=crop";  // person on phone professional

const FEATURES = [
  {
    n: "01",
    title: "Quote in 4 minutes on site",
    body: "Trade-specific fields built around what you actually see on the job. Fill in what is in front of you — the number calculates live as you go.",
  },
  {
    n: "02",
    title: "Send before you leave the driveway",
    body: "Hit send from your phone. The client gets a professional branded quote in their inbox while you are still on site.",
  },
  {
    n: "03",
    title: "Client accepts and pays online",
    body: "One tap to accept, tick the terms, choose how to pay — bank transfer, cash or card. No back-and-forth, no paperwork.",
  },
  {
    n: "04",
    title: "Quote becomes a job automatically",
    body: "Accepted quotes flip to jobs. Schedule the start date, upload drawings, track materials and log actuals against what you quoted.",
  },
  {
    n: "05",
    title: "Know if you made money",
    body: "Job costing tracks actual hours and materials vs what you quoted. See your real margin on every job, not just revenue.",
  },
  {
    n: "06",
    title: "Variations in writing, always",
    body: "Client wants to add scope mid-job? Raise a variation order in one tap. Gets signed off before you touch it.",
  },
  {
    n: "07",
    title: "Follow-up reminders built in",
    body: "Quotes going quiet? Automatic follow-up reminders so nothing falls through the cracks while you are on the tools.",
  },
  {
    n: "08",
    title: "VIC planning overlay checks",
    body: "Type in the address and Quotease checks VicPlan automatically. Heritage overlay detected? Labour estimate updates on the spot.",
  },
];

const TRADES = [
  { name: "Electricians",  detail: "Powerpoints, switchboards, downlights, solar, compliance certs" },
  { name: "Plumbers",      detail: "Tapware, hot water, rough-ins, gas fitting, drainage" },
  { name: "Carpenters",    detail: "Doors, framing, decking, fitout, skirting, architrave" },
  { name: "Roofers",       detail: "Colorbond, terracotta, gutters, skylights, scaffold" },
];

const PAIN_POINTS = [
  { x: "Quoting on a Word doc at 10pm",            y: "Built in 4 min on your phone, on site" },
  { x: "Losing jobs to whoever quoted first",       y: "Send before you reverse out of the driveway" },
  { x: "Scope creep with nothing in writing",       y: "Variation orders signed off before you start" },
  { x: "No idea if the job actually made money",    y: "Job costing — actual vs quoted, every time" },
  { x: "Chasing invoices for weeks",                y: "Client accepts and pays online, same day" },
];

export default function Home() {
  return (
    <main className="bg-[#0a1722] text-white overflow-hidden">

      {/* NAV */}
      <div className="absolute top-0 left-0 right-0 z-30 max-w-7xl mx-auto px-6 pt-6 flex items-center justify-between">
        <span className="font-display text-xl tracking-wide text-white drop-shadow-lg">QUOTEASE</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-white/80 hover:text-white font-semibold text-sm transition-colors hidden sm:block drop-shadow">
            Log in
          </Link>
          <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-sm px-5 py-2.5 rounded-xl hover:bg-[#e89e00] transition-colors">
            Sign up free
          </Link>
        </div>
      </div>

      {/* HERO */}
      <div className="relative h-screen min-h-[700px] max-h-[960px] flex items-end">
        <div className="absolute inset-0 z-0">
          <Image
            src={HERO_IMG}
            alt="Electrician working on residential switchboard"
            fill
            className="object-cover object-center"
            priority
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1722] via-[#0a1722]/50 to-[#0a1722]/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1722]/60 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-24 w-full">
          <div className="max-w-[680px]">
            <div className="inline-flex items-center gap-2 mb-6 bg-[#ffb400]/15 border border-[#ffb400]/30 rounded-full px-4 py-2 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb400]" />
              <span className="text-[12.5px] font-bold text-[#ffb400] tracking-wide uppercase">Built by a sparkie. For tradies.</span>
            </div>

            <h1 className="font-display uppercase leading-[0.88] mb-8">
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[6rem] text-white">Quote it.</span>
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[6rem] text-white">Send it.</span>
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[6rem] text-[#ffb400]">Win the job.</span>
            </h1>

            <p className="text-[17px] sm:text-[18px] leading-[1.65] text-[#c8d8e4] max-w-[520px] mb-10">
              Stop writing quotes on Word docs at 10pm. Quotease gets you
              a professional quote built and sent from your phone before you
              leave the driveway — while the other tradie is still working out their price.
            </p>

            <div className="flex flex-wrap gap-4 mb-8">
              <Link href="/signup"
                className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[16px] px-8 py-4 rounded-xl hover:bg-[#e89e00] transition-colors"
                style={{ boxShadow: "0 12px 32px rgba(255,180,0,.3)" }}>
                Sign up free — no card needed
              </Link>
              <Link href="/login"
                className="text-white font-bold text-[16px] px-6 py-4 rounded-xl border border-white/25 hover:border-white/50 transition-colors backdrop-blur-sm">
                Log in
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 text-[13px] font-semibold text-[#8aa4b4]">
              <span>Free during early access</span>
              <span className="text-[#2a3a47]">|</span>
              <span>Unlimited users</span>
              <span className="text-[#2a3a47]">|</span>
              <span>All 4 trades included</span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 opacity-50">
          <span className="text-[11px] font-bold tracking-[.2em] uppercase text-white">Scroll</span>
          <div className="w-px h-8 bg-white/40" />
        </div>
      </div>

      {/* TRADES STRIP */}
      <div className="bg-[#0c1e2e] border-t border-b border-white/[0.1]">
        <div className="max-w-7xl mx-auto px-6 py-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/[0.1]">
            {TRADES.map((t, i) => (
              <div key={t.name} className="px-6 py-8">
                <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#ffb400] mb-2">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className="font-extrabold text-white text-[15px] mb-1.5">{t.name}</p>
                <p className="text-[12px] text-[#6a8294] leading-snug">{t.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WHAT QUOTEASE DOES */}
      <div className="bg-[#0c1e2e] border-t border-white/[0.07]">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-16 items-start">
          <div className="lg:sticky lg:top-24">
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">The full toolkit</span>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.93] mt-3 mb-6 text-white">
              Everything from quote<br />to paid.
            </h2>
            <p className="text-[15px] text-[#7e94a2] leading-[1.7] mb-8">
              Most quoting tools stop at the quote. Quotease covers the whole job —
              from the first number on site to the final payment cleared.
            </p>
            <Link href="/signup" className="inline-flex bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-6 py-3.5 rounded-xl hover:bg-[#e89e00] transition-colors">
              Sign up free
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.n} className="bg-[#0e2233] border border-white/[0.09] rounded-2xl p-7 hover:border-[#ffb400]/30 transition-colors">
                <p className="font-display text-[1.6rem] leading-none mb-5 text-[#ffb400] select-none">{f.n}</p>
                <h3 className="font-extrabold text-[15px] text-white mb-2 leading-snug">{f.title}</h3>
                <p className="text-[13px] text-[#7e94a2] leading-[1.65]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>

      {/* ── PRICING & AI SHOWCASE ───────────────────────────────────── */}
      <div className="border-t border-white/[0.07] bg-[#0c1e2e]">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="mb-14 max-w-[640px]">
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Why quoting is actually fast</span>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.93] mt-3 text-white">
              The numbers are yours.<br />The typing isn&apos;t.
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Supplier pricing mockup */}
            <div className="bg-[#0a1722] border border-white/[0.09] rounded-3xl p-8 sm:p-9">
              <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#ffb400] mb-3">Your real prices</p>
              <h3 className="font-extrabold text-[20px] text-white mb-3 leading-snug">Upload your supplier&apos;s price list once</h3>
              <p className="text-[14px] text-[#7e94a2] leading-[1.65] mb-7">
                Every quote after that calculates off what you actually pay — not a generic estimate that&apos;s already wrong by the time your wholesaler updates prices.
              </p>
              <div className="bg-[#0e2233] border border-white/[0.08] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-white/70 uppercase tracking-wide">Materials library</span>
                  <span className="text-[10.5px] font-bold text-[#ffb400] bg-[#ffb400]/10 border border-[#ffb400]/20 px-2 py-1 rounded-full">CSV imported</span>
                </div>
                {[
                  { item: "20mm conduit (per m)", cost: "$2.40" },
                  { item: "GPO double, white", cost: "$8.90" },
                  { item: "RCBO 20A", cost: "$34.50" },
                  { item: "LED downlight 10W", cost: "$11.20" },
                ].map((row) => (
                  <div key={row.item} className="flex items-center justify-between py-2 border-t border-white/[0.06] first:border-t-0">
                    <span className="text-[13px] text-[#c8d8e4]">{row.item}</span>
                    <span className="text-[13px] font-bold text-white tabular">{row.cost}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI quoting mockup */}
            <div className="bg-[#0a1722] border border-white/[0.09] rounded-3xl p-8 sm:p-9">
              <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#ffb400] mb-3">AI does the first pass</p>
              <h3 className="font-extrabold text-[20px] text-white mb-3 leading-snug">Snap the plan. Talk through the job.</h3>
              <p className="text-[14px] text-[#7e94a2] leading-[1.65] mb-7">
                Photograph the floor plan or record yourself walking the site. AI reads it and drafts the scope — you check it and adjust before anything gets sent.
              </p>
              <div className="bg-[#0e2233] border border-white/[0.08] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-white/70 uppercase tracking-wide">Drawing read</span>
                  <span className="text-[10.5px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-full">Medium confidence</span>
                </div>
                {[
                  { item: "Power points", val: "8" },
                  { item: "Light points", val: "6" },
                  { item: "Switchboard upgrade", val: "Yes" },
                  { item: "Downlights", val: "10" },
                ].map((row) => (
                  <div key={row.item} className="flex items-center justify-between py-2 border-t border-white/[0.06] first:border-t-0">
                    <span className="text-[13px] text-[#c8d8e4]">{row.item}</span>
                    <span className="text-[13px] font-bold text-white tabular">{row.val}</span>
                  </div>
                ))}
                <p className="text-[11px] text-[#5a7385] mt-3 leading-snug">Review every field before sending — AI drafts, you decide.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PHOTO BREAK — site photo */}
      <div className="relative h-[55vh] min-h-[380px] overflow-hidden">
        <Image
          src={SITE_IMG}
          alt="Tradies on a residential job site"
          fill
          className="object-cover object-center"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a1722]/95 via-[#0a1722]/70 to-[#0a1722]/20" />
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-6">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-4">The problem we solved</p>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[3.2rem] leading-[0.93] text-white max-w-[540px] mb-5">
              54% of clients go with<br />the first quote they get.
            </h2>
            <p className="text-[16px] text-[#a9bcc8] max-w-[420px] leading-[1.6]">
              Speed wins the job. Quotease gets you there first — every time,
              from every site.
            </p>
          </div>
        </div>
      </div>

      {/* PROBLEM / FIX */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="mb-12">
          <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Sound familiar?</span>
          <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.93] mt-3 text-white">
            Every problem.<br />Already fixed.
          </h2>
        </div>
        <div className="flex flex-col divide-y divide-white/[0.06]">
          {PAIN_POINTS.map((p, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_1fr] gap-0 py-5 items-center">
              <div className="flex items-center gap-4 pr-8 pb-3 sm:pb-0">
                <span className="text-[11px] font-bold text-[#2a3a47] tabular w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[15px] text-[#4a6070] font-semibold line-through decoration-[#2a3a47]">{p.x}</span>
              </div>
              <div className="flex items-center gap-4 sm:border-l border-white/[0.06] sm:pl-8">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ffb400] shrink-0" />
                <span className="text-[15px] text-white font-semibold">{p.y}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BUILT BY A TRADIE */}
      <div className="border-t border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative rounded-2xl overflow-hidden aspect-[4/3] order-2 lg:order-1">
            <Image
              src="https://images.squarespace-cdn.com/content/v1/6848e6851124a2687a93a35f/ea135f61-ba35-4cdd-a281-ffcab6e07c5e/residential-electrician-melbourne-lounge+room.jpg"
              alt="High-spec residential electrical install — Spark Ease Electrical, Melbourne"
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-5">
              <p className="text-[11px] text-white/60">Spark Ease Electrical, Melbourne. Builder: Tykon. Photographer: Dan Preston</p>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Who built this</span>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.93] mt-3 mb-6 text-white">
              A sparkie who got sick<br />of bad software.
            </h2>
            <p className="text-[15.5px] text-[#a9bcc8] leading-[1.7] mb-5">
              Nick has been running Spark Ease Electrical across Melbourne since 2013.
              Bayside, Mornington Peninsula, inner suburbs. High-spec residential builds,
              renovations, commercial fitouts.
            </p>
            <p className="text-[15.5px] text-[#a9bcc8] leading-[1.7] mb-8">
              He built Quotease because every piece of software he tried was either
              built by people who had never held a cable puller, or so bloated
              it took three weeks to set up. Quotease does what a tradie
              actually needs. Nothing more.
            </p>

            <div className="flex items-center gap-4 p-4 bg-[#0e2233] border border-white/[0.07] rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-[#ffb400] flex items-center justify-center font-display text-xl text-[#0a1722] shrink-0">N</div>
              <div>
                <p className="font-bold text-white text-[14px]">Nick</p>
                <p className="text-[12.5px] text-[#7e94a2]">Spark Ease Electrical Services</p>
                <p className="text-[12px] text-[#4a5d6a]">Melbourne, VIC  ·  REC 23538  ·  Since 2013</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VS COMPETITORS */}
      <div className="border-t border-white/[0.07] bg-[#0c1e2e]">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="mb-12">
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Why not just use Fergus?</span>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.93] mt-3 text-white">
              Built for a crew of 20.<br />You have got a ute.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Setup time",    them: "3 weeks",        us: "Day one" },
              { label: "Built for",     them: "Teams of 10+",   us: "Sole traders" },
              { label: "Price",         them: "$40+/user/month", us: "Free right now" },
              { label: "Scope",         them: "HR, SWMS, POs",  us: "Quote. Job. Paid." },
            ].map((r) => (
              <div key={r.label} className="bg-[#0a1722] border border-white/[0.07] rounded-2xl p-6">
                <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#ffb400] mb-4">{r.label}</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-red-500/15 flex items-center justify-center text-[10px] text-red-400 font-bold shrink-0">x</span>
                    <span className="text-[13px] text-[#4a6070]">{r.them}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#ffb400]/15 flex items-center justify-center text-[10px] text-[#ffb400] font-bold shrink-0">✓</span>
                    <span className="text-[13px] text-white font-semibold">{r.us}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Pricing</span>
          <h2 className="font-display uppercase text-[2.5rem] sm:text-[3.2rem] leading-[0.93] mt-3 mb-8 text-white">
            Free right now.<br />No catch.
          </h2>
          <div className="flex flex-col divide-y divide-white/[0.06]">
            {[
              "Free during early access — no credit card, ever",
              "Unlimited users, unlimited quotes",
              "All 4 trades included from day one",
              "VIC planning overlay checks built in",
              "Xero CSV export included",
              "We'll ask for feedback as we build this out",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3 py-3.5 text-[14.5px] text-[#c8d8e4] font-semibold">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ffb400] shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0e2233] border border-white/[0.1] rounded-3xl overflow-hidden" style={{ boxShadow: "0 24px 64px rgba(0,0,0,.4)" }}>
          <div className="h-3" style={{ background: "repeating-linear-gradient(135deg,#FFB400 0 14px,#E89E00 14px 28px)" }} />
          <div className="p-10 text-center">
            <p className="text-[12px] font-bold tracking-[.2em] uppercase text-[#7e94a2] mb-4">Early access</p>
            <div className="flex items-end justify-center gap-2 mb-2">
              <span className="font-display text-[6rem] leading-[0.85] text-[#ffb400]">$0</span>
            </div>
            <p className="text-[#7e94a2] text-[14px] mb-1">free while we&apos;re building this out</p>
            <p className="text-[12px] text-[#3a4f5e] mb-8">In exchange, we&apos;ll ask for your feedback — and hope to earn a testimonial along the way.</p>
            <Link href="/signup" className="block bg-[#ffb400] text-[#0a1722] font-extrabold text-[17px] py-4 rounded-xl mb-3 hover:bg-[#e89e00] transition-colors">
              Sign up free
            </Link>
            <Link href="/login" className="block text-[#7e94a2] text-[14px] hover:text-white transition-colors">
              Already have an account? Log in
            </Link>
          </div>
        </div>
      </div>

      {/* FOOTER CTA */}
      <div className="bg-[#ffb400]">
        <div className="max-w-7xl mx-auto px-6 py-20 grid sm:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <h2 className="font-display uppercase text-[2.8rem] sm:text-[3.5rem] leading-[0.92] mb-3 text-[#0a1722]">
              The other tradie just<br />sent their quote.
            </h2>
            <p className="font-bold text-[16px] text-[#0a1722]/60">How long does yours take?</p>
          </div>
          <Link href="/signup"
            className="bg-[#0a1722] text-[#ffb400] font-extrabold text-[17px] px-10 py-5 rounded-xl hover:bg-[#0e2233] transition-colors whitespace-nowrap">
            Start quoting today
          </Link>
        </div>
        <div className="border-t border-black/[0.12]">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-lg text-[#0a1722]">QUOTEASE</span>
            <span className="text-[12px] font-semibold text-[#0a1722]/50">Built by Spark Ease Electrical, Melbourne</span>
            <div className="flex gap-6 text-[12.5px] font-semibold text-[#0a1722]/50">
              <Link href="/login" className="hover:text-[#0a1722] transition-colors">Log in</Link>
              <Link href="/signup" className="hover:text-[#0a1722] transition-colors">Sign up</Link>
            </div>
          </div>
        </div>
      </div>

    </main>
  );
}
