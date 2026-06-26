import Link from "next/link";
import Image from "next/image";

// Real Spark Ease job site photography
const HERO_IMG    = "https://images.squarespace-cdn.com/content/v1/6848e6851124a2687a93a35f/6a54c626-1153-4fd3-8d44-289447b3988d/residential-electrician-melbourne.jpg";
const KITCHEN_IMG = "https://images.squarespace-cdn.com/content/v1/6848e6851124a2687a93a35f/7d6b3d49-33db-4ddc-840a-30002549ed61/residential-electrician-melbourne-kitchen.jpg";
const LOUNGE_IMG  = "https://images.squarespace-cdn.com/content/v1/6848e6851124a2687a93a35f/ea135f61-ba35-4cdd-a281-ffcab6e07c5e/residential-electrician-melbourne-lounge+room.jpg";

const FEATURES = [
  {
    emoji: "📋",
    title: "Quote on site in 4 minutes",
    body: "Trade-specific fields built around what you actually see on the job. Fill in what's in front of you — the number calculates live as you go.",
  },
  {
    emoji: "📧",
    title: "Send before you leave the driveway",
    body: "Hit send from your phone. The client gets a professional branded quote in their inbox while you're still on site.",
  },
  {
    emoji: "✅",
    title: "Client accepts online",
    body: "One tap to accept, tick the terms, choose payment method — bank transfer, cash or card. No back-and-forth, no paperwork.",
  },
  {
    emoji: "🗓️",
    title: "Quote becomes a job automatically",
    body: "Accepted quotes flip to jobs. Schedule the start date, upload drawings, track materials and log actuals against what you quoted.",
  },
  {
    emoji: "💰",
    title: "Know if you made money",
    body: "Job costing tracks actual hours and materials vs what you quoted. See your real margin on every job — not just revenue.",
  },
  {
    emoji: "📄",
    title: "Variations in writing, always",
    body: "Client wants to add scope mid-job? Raise a variation order with one tap. Gets signed off before you touch it.",
  },
  {
    emoji: "🔔",
    title: "Follow-up reminders built in",
    body: "Quotes going quiet? Automatic follow-up reminders so nothing falls through the cracks while you're on the tools.",
  },
  {
    emoji: "🏛️",
    title: "Heritage & planning overlays (VIC)",
    body: "Type in the site address and Quotease checks VicPlan automatically. Heritage overlay? Labour estimate updates instantly.",
  },
];

const TRADES = [
  { emoji: "⚡", name: "Electricians",  desc: "Powerpoints, switchboards, downlights, solar, certs" },
  { emoji: "🔧", name: "Plumbers",      desc: "Tapware, hot water, rough-ins, gas, drainage" },
  { emoji: "🪚", name: "Carpenters",    desc: "Doors, framing, decking, fitout, skirting" },
  { emoji: "🏠", name: "Roofers",       desc: "Colorbond, tiles, gutters, skylights, scaffold" },
];

const PAIN_POINTS = [
  { x: "Quoting on a Word doc at 10pm",       y: "Built in 4 min on your phone, on site" },
  { x: "Losing jobs to the tradie who quoted first",  y: "Send before you reverse out of the driveway" },
  { x: "Scope creep with nothing in writing", y: "Variation orders signed off before you start" },
  { x: "No idea if the job made money",       y: "Job costing — actual vs quoted, every time" },
  { x: "Chasing invoices for weeks",          y: "Client accepts and pays online, same day" },
];

export default function Home() {
  return (
    <main className="bg-[#0a1722] text-white overflow-hidden">

      {/* NAV */}
      <div className="relative z-20 max-w-7xl mx-auto px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl tracking-wide text-white">QUOTEASE</span>
          <span className="hidden sm:block text-[10px] font-bold tracking-[.15em] uppercase text-[#ffb400] bg-[#ffb400]/10 px-2 py-1 rounded-md border border-[#ffb400]/20">
            Built by tradies
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-[#a9bcc8] hover:text-white font-semibold text-sm transition-colors hidden sm:block">Log in</Link>
          <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-sm px-5 py-2.5 rounded-xl hover:bg-[#e89e00] transition-colors">
            Start free trial
          </Link>
        </div>
      </div>

      {/* HERO — full-bleed image with overlay */}
      <div className="relative min-h-[92vh] flex items-end">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <Image
            src={HERO_IMG}
            alt="Residential electrical work — Spark Ease Electrical, Melbourne"
            fill
            className="object-cover object-center"
            priority
            unoptimized
          />
          {/* Dark gradient overlay — heavy at bottom, lighter at top */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a1722]/60 via-[#0a1722]/40 to-[#0a1722]/95" />
        </div>

        {/* Hero text — sits over image */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-20 pt-32 w-full">
          <div className="max-w-[720px]">
            <div className="inline-flex items-center gap-2.5 mb-6 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-[#ffb400] animate-pulse" />
              <span className="text-[13px] font-semibold text-white/90">
                Quote it. Send it. Win it — before they call the next tradie.
              </span>
            </div>

            <h1 className="font-display uppercase leading-[0.9] mb-7 text-white">
              <span className="block text-[3rem] sm:text-[5rem] lg:text-[5.5rem]">Stop losing jobs</span>
              <span className="block text-[3rem] sm:text-[5rem] lg:text-[5.5rem]">to the tradie who</span>
              <span className="block text-[3rem] sm:text-[5rem] lg:text-[5.5rem] text-[#ffb400]">quoted faster.</span>
            </h1>

            <p className="text-[17px] sm:text-[19px] leading-[1.6] text-[#d5e0e7] max-w-[540px] mb-10">
              Quotease is quoting and job management built for residential tradies.
              Fill in what you see on site, get a real number, send it professionally —
              all before you have left the driveway.
            </p>

            <div className="flex flex-wrap gap-4 mb-8">
              <Link href="/signup"
                className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[16px] px-8 py-4 rounded-xl hover:bg-[#e89e00] transition-colors"
                style={{ boxShadow: "0 12px 32px rgba(255,180,0,.28)" }}>
                Start free — 7 days, no card
              </Link>
              <Link href="/login"
                className="inline-flex items-center gap-2 text-white font-bold text-[16px] px-6 py-4 rounded-xl border border-white/30 hover:border-white/60 transition-colors backdrop-blur-sm">
                Log in
              </Link>
            </div>

            <div className="flex flex-wrap gap-5 text-[13px] font-semibold text-[#a9bcc8]">
              <span className="flex items-center gap-2"><span className="text-[#ffb400]">✓</span> 7-day free trial</span>
              <span className="flex items-center gap-2"><span className="text-[#ffb400]">✓</span> $40/mo flat, unlimited users</span>
              <span className="flex items-center gap-2"><span className="text-[#ffb400]">✓</span> All 4 trades included</span>
            </div>
          </div>
        </div>
      </div>

      {/* TRADES STRIP */}
      <div className="border-t border-b border-white/[0.07] bg-[#0c1e2e]">
        <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {TRADES.map((t) => (
            <div key={t.name} className="flex items-start gap-3">
              <span className="text-2xl shrink-0 mt-0.5">{t.emoji}</span>
              <div>
                <p className="font-bold text-white text-[14px]">{t.name}</p>
                <p className="text-[12px] text-[#7e94a2] leading-snug mt-0.5">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WHAT QUOTEASE DOES */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="mb-14">
          <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Everything in one place</span>
          <h2 className="font-display uppercase text-[2.2rem] sm:text-[3rem] leading-[0.93] mt-3 text-white max-w-[680px]">
            From first call to final payment.<br className="hidden sm:block" />
            <span className="text-[#ffb400]">One tool. No fuss.</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-[#0e2233] border border-white/[0.07] rounded-2xl p-6 hover:border-[#ffb400]/30 transition-colors">
              <span className="text-3xl block mb-4">{f.emoji}</span>
              <h3 className="font-extrabold text-[15px] text-white mb-2 leading-snug">{f.title}</h3>
              <p className="text-[13px] text-[#7e94a2] leading-[1.6]">{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* JOB SITE PHOTO BREAK */}
      <div className="relative h-[50vh] overflow-hidden">
        <Image
          src={KITCHEN_IMG}
          alt="High-spec residential kitchen electrical install — Spark Ease Electrical"
          fill
          className="object-cover object-center"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a1722]/90 via-[#0a1722]/50 to-transparent" />
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-6">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">The problem we solved</p>
            <h2 className="font-display uppercase text-[2rem] sm:text-[2.8rem] leading-[0.95] text-white max-w-[500px]">
              Most tradies quote too slow<br />and lose the job.
            </h2>
            <p className="text-[15px] text-[#a9bcc8] mt-4 max-w-[420px]">
              54% of clients go with the first quote they receive.<br />
              Quotease gets you there first, every time.
            </p>
          </div>
        </div>
      </div>

      {/* PROBLEM / FIX */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="mb-12">
          <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Sound familiar?</span>
          <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.93] mt-3 text-white">
            Every problem has a fix built in.
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          {PAIN_POINTS.map((p, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_40px_1fr] gap-3 sm:gap-4 items-center bg-[#0e2233] border border-white/[0.07] rounded-2xl px-5 sm:px-7 py-4">
              <div className="flex items-center gap-3">
                <span className="text-red-400 text-lg shrink-0">✗</span>
                <span className="text-[14px] text-[#7e94a2] font-semibold">{p.x}</span>
              </div>
              <span className="hidden sm:block text-[#2a3a47] text-2xl text-center">›</span>
              <div className="flex items-center gap-3">
                <span className="text-[#ffb400] text-lg shrink-0">✓</span>
                <span className="text-[14px] text-white font-semibold">{p.y}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BUILT BY A TRADIE */}
      <div className="bg-[#0c1e2e] border-t border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Why it exists</span>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.95] mt-4 mb-6 text-white">
              Built by a sparkie.<br />Not a software company.
            </h2>
            <p className="text-[15.5px] text-[#a9bcc8] leading-[1.7] mb-5">
              Nick has been running Spark Ease Electrical in Melbourne since 2013 — Bayside,
              Mornington Peninsula, inner suburbs. He built Quotease because Fergus took three weeks
              to set up and Tradify was built for teams of 20, not sole traders.
            </p>
            <p className="text-[15.5px] text-[#a9bcc8] leading-[1.7] mb-8">
              Quotease does what a tradie actually needs: quote fast, send professionally,
              get the job accepted, track it to completion, get paid. Nothing more.
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#ffb400] flex items-center justify-center font-display text-xl text-[#0a1722]">N</div>
              <div>
                <p className="font-bold text-white text-[14px]">Nick</p>
                <p className="text-[12.5px] text-[#7e94a2]">Spark Ease Electrical · Melbourne · REC 23538</p>
              </div>
            </div>
          </div>

          {/* Real lounge room photo */}
          <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
            <Image
              src={LOUNGE_IMG}
              alt="High-spec residential lounge electrical install — Spark Ease Electrical"
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a1722]/80 to-transparent p-5">
              <p className="text-[11px] text-[#a9bcc8]">Builder: Tykon · Photographer: Dan Preston</p>
            </div>
          </div>
        </div>
      </div>

      {/* VS COMPETITORS */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="bg-[#0e2233] border border-white/[0.08] rounded-3xl overflow-hidden">
          <div className="p-8 sm:p-10 lg:p-14">
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">vs Fergus and Tradify</span>
            <h2 className="font-display uppercase text-[2rem] sm:text-[2.5rem] leading-[0.95] mt-4 mb-8 text-white">
              Why not just use what everyone else uses?
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { them: "3 weeks to set up properly",        us: "Quoting on day one" },
                { them: "Built for teams of 10+",            us: "Sole traders and small crews" },
                { them: "$40 per user per month",            us: "$40 flat — unlimited users" },
                { them: "SWMS, HR, POs, scheduling, procurement", us: "Quote. Job. Invoice. Paid." },
              ].map((r, i) => (
                <div key={i} className="grid grid-cols-2 gap-3 text-[13px]">
                  <div className="flex items-start gap-2 bg-white/[0.03] rounded-xl px-3 py-3">
                    <span className="text-red-400 shrink-0">✗</span>
                    <span className="text-[#7e94a2]">{r.them}</span>
                  </div>
                  <div className="flex items-start gap-2 bg-[#ffb400]/[0.07] border border-[#ffb400]/20 rounded-xl px-3 py-3">
                    <span className="text-[#ffb400] shrink-0">✓</span>
                    <span className="text-white font-semibold">{r.us}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div className="bg-[#0c1e2e] border-t border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Pricing</span>
            <h2 className="font-display uppercase text-[2.5rem] sm:text-[3.2rem] leading-[0.93] mt-3 mb-6 text-white">
              One price.<br />No surprises.
            </h2>
            <div className="flex flex-col gap-3 mb-6">
              {[
                "7-day free trial — no credit card",
                "Unlimited users, unlimited quotes",
                "All 4 trades included",
                "VIC planning overlay checks built in",
                "Xero CSV export included",
                "Cancel any time, no lock-in",
              ].map((f) => (
                <div key={f} className="flex items-center gap-3 text-[14.5px] text-[#d5e0e7] font-semibold">
                  <span className="text-[#ffb400]">✓</span> {f}
                </div>
              ))}
            </div>
            <p className="text-[13px] text-[#7e94a2]">
              Fergus charges $40/user/month. Three of you costs $120.<br />
              Quotease is $40 flat. Full stop.
            </p>
          </div>

          <div className="bg-[#0a1722] border border-white/[0.1] rounded-3xl overflow-hidden"
            style={{ boxShadow: "0 24px 64px rgba(0,0,0,.4)" }}>
            <div className="h-3" style={{ background: "repeating-linear-gradient(135deg,#FFB400 0 14px,#E89E00 14px 28px)" }} />
            <div className="p-10 text-center">
              <p className="text-[13px] font-bold tracking-[.15em] uppercase text-[#7e94a2] mb-3">Monthly subscription</p>
              <div className="flex items-end justify-center gap-1.5 mb-2">
                <span className="font-display text-[5.5rem] leading-[0.85] text-[#ffb400]">$40</span>
                <span className="font-extrabold text-xl text-[#7e94a2] pb-3">/mo</span>
              </div>
              <p className="text-[#7e94a2] font-semibold text-[14px] mb-2">flat — unlimited users</p>
              <p className="text-[12.5px] text-[#4a5d6a] mb-8">First 7 days free. Then $40/mo. Cancel anytime.</p>
              <Link href="/signup"
                className="block bg-[#ffb400] text-[#0a1722] font-extrabold text-[17px] py-4 rounded-xl mb-3 hover:bg-[#e89e00] transition-colors">
                Start your free trial
              </Link>
              <Link href="/login" className="block text-[#7e94a2] font-semibold text-[14px] hover:text-white transition-colors">
                Already have an account? Log in
              </Link>
            </div>
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
            <p className="font-bold text-[16px] text-[#0a1722]/70">How long does yours take?</p>
          </div>
          <Link href="/signup"
            className="bg-[#0a1722] text-[#ffb400] font-extrabold text-[17px] px-10 py-5 rounded-xl whitespace-nowrap hover:bg-[#0e2233] transition-colors inline-block text-center">
            Start quoting today
          </Link>
        </div>
        <div className="border-t border-black/[0.15]">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="font-display text-lg text-[#0a1722]">QUOTEASE</span>
              <span className="text-[11px] font-bold text-[#0a1722]/50">Built by Spark Ease Electrical, Melbourne</span>
            </div>
            <div className="flex gap-6 text-[12.5px] font-semibold text-[#0a1722]/60">
              <Link href="/login" className="hover:text-[#0a1722] transition-colors">Log in</Link>
              <Link href="/signup" className="hover:text-[#0a1722] transition-colors">Sign up</Link>
            </div>
          </div>
        </div>
      </div>

    </main>
  );
}
