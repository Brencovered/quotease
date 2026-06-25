import Link from "next/link";

const STATS = [
  { n: "4 min",  label: "Average time to build a quote" },
  { n: "54%",    label: "Of clients decide within 4 hours" },
  { n: "$0",     label: "Per-user fees. Ever." },
  { n: "7 days", label: "Free trial, no card needed" },
];

const WORKFLOW = [
  {
    n: "01",
    title: "On site — pull out your phone",
    body: "You're standing in their driveway. Open Quotease, pick your trade, tap through what you see. No typing paragraphs. No guessing.",
    detail: "Takes 4 minutes on average",
  },
  {
    n: "02",
    title: "A real number, instantly",
    body: "Your rates. Your supplier prices. Your margins. The quote calculates live as you fill it in — before you've even left the property.",
    detail: "Based on what you actually pay",
  },
  {
    n: "03",
    title: "Send it before they call the next tradie",
    body: "Hit send from the driveway. The client gets a professional quote in their inbox while the other tradie is still writing theirs on a serviette.",
    detail: "Email straight from your phone",
  },
  {
    n: "04",
    title: "Job won. Work tracked. Get paid.",
    body: "Accepted quotes become jobs automatically. Schedule it, upload drawings, log actuals, raise variations, record payments. All in one place.",
    detail: "Quote → Job → Invoice → Paid",
  },
];

const TRADES = [
  { emoji: "⚡", label: "Electricians" },
  { emoji: "🔧", label: "Plumbers" },
  { emoji: "🪚", label: "Carpenters" },
  { emoji: "🏠", label: "Roofers" },
];

const PAIN_POINTS = [
  { problem: "Quoting from memory on a Word doc", fix: "Trade-specific fields, live total, done in 4 minutes" },
  { problem: "Losing jobs because you were slow to quote", fix: "Send a professional quote before you leave the site" },
  { problem: "Scope creep with nothing in writing", fix: "Variation orders with client sign-off, every time" },
  { problem: "No idea if the job actually made money", fix: "Job costing — actual hours vs quoted, margin tracked" },
  { problem: "Chasing payment on old invoices", fix: "Follow-up reminders, expiry alerts, payment tracking" },
];

const TESTIMONIALS = [
  {
    quote: "I used to quote jobs on my lunch break back at the office. Now I send it before I've reversed out of the driveway.",
    name: "Nick",
    trade: "Electrician, Melbourne",
    initial: "N",
  },
  {
    quote: "Fergus took me three weeks to set up. Quotease took me twenty minutes and I was quoting real jobs the same day.",
    name: "Tom",
    trade: "Plumber, Sydney",
    initial: "T",
  },
  {
    quote: "The variation order feature alone has saved me from three client disputes this year. Everything's in writing now.",
    name: "Damo",
    trade: "Carpenter, Brisbane",
    initial: "D",
  },
];

export default function Home() {
  return (
    <main className="bg-[#0a1722] text-white overflow-hidden">

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl tracking-wide text-white">QUOTEASE</span>
          <span className="text-[10px] font-bold tracking-[.15em] uppercase text-[#ffb400] bg-[#ffb400]/10 px-2 py-1 rounded-md border border-[#ffb400]/20">
            Built by tradies
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-[#a9bcc8] hover:text-white font-semibold text-sm transition-colors hidden sm:block">
            Log in
          </Link>
          <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-sm px-5 py-2.5 rounded-xl hover:bg-[#e89e00] transition-colors">
            Start free →
          </Link>
        </div>
      </div>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-20">
        <div className="max-w-[780px]">

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-3 mb-7 bg-white/[0.05] border border-white/10 rounded-full px-4 py-2">
            <span className="w-2 h-2 rounded-full bg-[#ffb400] animate-pulse" />
            <span className="text-[13px] font-semibold text-[#a9bcc8]">
              The fastest quote wins the job. Every time.
            </span>
          </div>

          <h1 className="font-display uppercase leading-[0.9] mb-7 text-white">
            <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[6rem]">Quote it.</span>
            <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[6rem]">Send it.</span>
            <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[6rem] text-[#ffb400]">Win it.</span>
          </h1>

          <p className="text-[17px] sm:text-[19px] leading-[1.65] text-[#a9bcc8] max-w-[560px] mb-10">
            Quotease is quoting and job management built specifically for residential tradies —
            by a sparkie who got sick of losing jobs to slower competitors with better software.
            Quote on your phone. Send before you leave. Get paid faster.
          </p>

          <div className="flex flex-wrap gap-4 mb-10">
            <Link href="/signup"
              className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[16px] px-8 py-4 rounded-xl hover:bg-[#e89e00] transition-colors"
              style={{ boxShadow: "0 12px 32px rgba(255,180,0,.28)" }}>
              Start free — 7 days, no card
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-2 text-white font-bold text-[16px] px-6 py-4 rounded-xl border border-white/20 hover:border-white/40 transition-colors">
              Log in →
            </Link>
          </div>

          {/* Trade badges */}
          <div className="flex flex-wrap gap-2.5">
            {TRADES.map((t) => (
              <span key={t.label} className="inline-flex items-center gap-2 text-[13px] font-bold text-[#7e94a2] bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-lg">
                {t.emoji} {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── STATS BAR ───────────────────────────────────────────────── */}
      <div className="border-t border-b border-white/[0.07] bg-[#0c1e2e]">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.n} className="text-center">
              <p className="font-display text-[2.2rem] text-[#ffb400] leading-none mb-1">{s.n}</p>
              <p className="text-[12.5px] text-[#7e94a2] font-semibold leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── PROBLEM / FIX ───────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Sound familiar?</span>
          <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.95] mt-3 text-white">
            Every problem you&apos;re dealing with<br className="hidden sm:block" /> has a fix built in.
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          {PAIN_POINTS.map((p, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_auto_1fr] gap-4 sm:gap-6 items-center bg-[#0e2233] border border-white/[0.07] rounded-2xl px-5 sm:px-7 py-5">
              <div className="flex items-center gap-3">
                <span className="text-red-400 text-xl shrink-0">✗</span>
                <span className="text-[14.5px] text-[#7e94a2] font-semibold">{p.problem}</span>
              </div>
              <span className="hidden sm:block text-[#2a3a47] text-2xl font-thin">→</span>
              <div className="flex items-center gap-3">
                <span className="text-[#ffb400] text-xl shrink-0">✓</span>
                <span className="text-[14.5px] text-white font-semibold">{p.fix}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── WORKFLOW ────────────────────────────────────────────────── */}
      <div className="bg-[#0c1e2e] border-t border-white/[0.07]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="mb-12">
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">The workflow</span>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.95] mt-3 text-white">
              Quote to paid.<br className="hidden sm:block" /> Four steps. Done.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {WORKFLOW.map((s) => (
              <div key={s.n} className="bg-[#0a1722] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden">
                {/* Step number watermark */}
                <div className="absolute -top-2 -right-1 font-display text-[5rem] leading-none select-none pointer-events-none"
                  style={{ color: "transparent", WebkitTextStroke: "1px rgba(255,180,0,0.12)" }}>
                  {s.n}
                </div>
                <div className="font-display text-[#ffb400] text-[2.8rem] leading-none mb-5">{s.n}</div>
                <h3 className="font-extrabold text-[16px] text-white mb-2 leading-snug">{s.title}</h3>
                <p className="text-[13.5px] text-[#7e94a2] leading-[1.6] mb-4">{s.body}</p>
                <span className="inline-block text-[11.5px] font-bold text-[#ffb400] bg-[#ffb400]/10 border border-[#ffb400]/20 px-3 py-1 rounded-full">
                  {s.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BUILT BY A TRADIE ───────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="bg-[#0e2233] border border-white/[0.08] rounded-3xl overflow-hidden">
          <div className="grid lg:grid-cols-[1fr_1px_1fr]">
            <div className="p-8 sm:p-10 lg:p-14">
              <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Why it exists</span>
              <h2 className="font-display uppercase text-[2rem] sm:text-[2.5rem] leading-[0.95] mt-4 mb-6 text-white">
                Built by a sparkie.<br />Not a software company.
              </h2>
              <p className="text-[15.5px] text-[#a9bcc8] leading-[1.7] mb-5">
                Nick has been running Spark Ease Electrical in Melbourne since 2013. He built Quotease
                because every piece of software he tried was either built by people who&apos;d never held
                a cable puller, or was so bloated it took three weeks to set up.
              </p>
              <p className="text-[15.5px] text-[#a9bcc8] leading-[1.7] mb-8">
                Quotease does what a tradie actually needs: quote fast, send professionally,
                track the job, get paid. Nothing more. Nothing less.
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#ffb400] flex items-center justify-center font-display text-xl text-[#0a1722]">N</div>
                <div>
                  <p className="font-bold text-white text-[14px]">Nick</p>
                  <p className="text-[12.5px] text-[#7e94a2]">Spark Ease Electrical · Melbourne · REC 23538</p>
                </div>
              </div>
            </div>

            <div className="hidden lg:block bg-white/[0.05]" />

            <div className="p-8 sm:p-10 lg:p-14 border-t border-white/[0.07] lg:border-t-0">
              <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">vs. the big players</span>
              <h3 className="font-extrabold text-[18px] text-white mt-4 mb-6">Why not Fergus or Tradify?</h3>
              <div className="space-y-4">
                {[
                  { them: "Weeks to set up properly", us: "Quoting on day one" },
                  { them: "Built for teams of 10+", us: "Sole traders and small crews" },
                  { them: "$40/user/month", us: "$40 flat, unlimited users" },
                  { them: "Everything — scheduling, POs, SWMS, HR", us: "Quote. Job. Invoice. Paid." },
                ].map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr] gap-3 text-[13px]">
                    <div className="flex items-start gap-2 bg-white/[0.03] rounded-lg px-3 py-2.5">
                      <span className="text-red-400 shrink-0 mt-0.5">✗</span>
                      <span className="text-[#7e94a2]">{r.them}</span>
                    </div>
                    <div className="flex items-start gap-2 bg-[#ffb400]/[0.07] border border-[#ffb400]/20 rounded-lg px-3 py-2.5">
                      <span className="text-[#ffb400] shrink-0 mt-0.5">✓</span>
                      <span className="text-white font-semibold">{r.us}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TESTIMONIALS ────────────────────────────────────────────── */}
      <div className="bg-[#0c1e2e] border-t border-white/[0.07]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="mb-12">
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">From tradies</span>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.95] mt-3 text-white">
              What happens when you quote faster.
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-[#0a1722] border border-white/[0.07] rounded-2xl p-7 flex flex-col">
                <p className="text-[15px] text-[#d5e0e7] leading-[1.7] flex-1 mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-5 border-t border-white/[0.07]">
                  <div className="w-9 h-9 rounded-full bg-[#ffb400]/20 border border-[#ffb400]/30 flex items-center justify-center font-display text-[#ffb400] text-sm">
                    {t.initial}
                  </div>
                  <div>
                    <p className="font-bold text-white text-[13px]">{t.name}</p>
                    <p className="text-[11.5px] text-[#7e94a2]">{t.trade}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRICING ─────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">Pricing</span>
            <h2 className="font-display uppercase text-[2.5rem] sm:text-[3.2rem] leading-[0.93] mt-3 mb-6 text-white">
              One price.<br />No surprises.
            </h2>
            <p className="text-[16px] text-[#a9bcc8] leading-[1.65] mb-6">
              Fergus charges $40 per user per month. A crew of three costs you $120.
              Quotease is $40 flat — for everyone in your business. Always.
            </p>
            <div className="flex flex-col gap-3">
              {["7-day free trial, no credit card", "Unlimited users, unlimited quotes", "All trades included — sparky, plumber, chippy, roofer", "Xero CSV export built in", "Cancel anytime, no lock-in"].map((f) => (
                <div key={f} className="flex items-center gap-3 text-[14.5px] text-[#d5e0e7] font-semibold">
                  <span className="text-[#ffb400]">✓</span> {f}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0e2233] border border-white/[0.1] rounded-3xl overflow-hidden"
            style={{ boxShadow: "0 24px 64px rgba(0,0,0,.4)" }}>
            <div className="h-3" style={{ background: "repeating-linear-gradient(135deg,#FFB400 0 14px,#E89E00 14px 28px)" }} />
            <div className="p-10 text-center">
              <p className="text-[13px] font-bold tracking-[.15em] uppercase text-[#7e94a2] mb-3">Monthly subscription</p>
              <div className="flex items-end justify-center gap-1.5 mb-1">
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
                Already have an account? Log in →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER CTA ──────────────────────────────────────────────── */}
      <div className="bg-[#ffb400]">
        <div className="max-w-6xl mx-auto px-6 py-20 grid sm:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <h2 className="font-display uppercase text-[2.8rem] sm:text-[3.5rem] leading-[0.92] mb-3 text-[#0a1722]">
              The other tradie<br />just sent their quote.
            </h2>
            <p className="font-bold text-[16px] text-[#0a1722]/70">How long does yours take?</p>
          </div>
          <Link href="/signup"
            className="bg-[#0a1722] text-[#ffb400] font-extrabold text-[17px] px-10 py-5 rounded-xl whitespace-nowrap hover:bg-[#0e2233] transition-colors inline-block text-center"
            style={{ boxShadow: "0 12px 32px rgba(10,23,34,.3)" }}>
            Start quoting today →
          </Link>
        </div>

        <div className="border-t border-black/[0.15]">
          <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4">
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
