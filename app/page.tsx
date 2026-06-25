import Link from "next/link";

const QUOTE_ITEMS = [
  { label: "Switchboard upgrade", val: "$380" },
  { label: "Power points × 6",    val: "$312" },
  { label: "Downlights × 12",     val: "$420" },
  { label: "Roof access — tight crawl", val: "×1.7" },
];

const STEPS = [
  { n: "01", title: "Pick your trades",     body: "Set it up once. Every job after uses fields built for how you actually work." },
  { n: "02", title: "Fill in what you see", body: "Tap through fields made for the job in front of you — no generic form." },
  { n: "03", title: "Get a real number",    body: "It calculates off your own supplier pricing, not a guess." },
  { n: "04", title: "Send it & get paid",   body: "Email the quote, set deposit terms, track what's outstanding." },
];

const FEATURES = [
  { tag: "Trade",     title: "Built for your trade",        body: "Pick your trades once. Every job after that uses fields built for how you actually work — not a generic form bolted onto a scheduling app." },
  { tag: "Materials", title: "Your real prices",            body: "Upload your own supplier pricing. The quote calculates off what you actually pay, not a guess." },
  { tag: "Payment",   title: "Send it, track it, get paid", body: "Email the quote straight to the client. Set payment terms — deposit up front, balance on completion — and see what's still outstanding." },
];

const FAQS = [
  { q: "Is it really $40 a month, flat?",    a: "One price. Unlimited users, no per-seat fees, cancel anytime." },
  { q: "Do I need to be techy?",             a: "No. If you can take a photo on site, you can build a quote." },
  { q: "Can I use my own supplier pricing?", a: "Upload your price list and every quote calculates off what you actually pay." },
  { q: "What trades is it for?",             a: "Sparkies, plumbers, chippies and more — pick your trades and the fields fit how you work." },
  { q: "Is there a free trial?",             a: "Seven days free, unlimited users, cancel anytime. Start quoting today." },
];

const TRADES = ["Sparkies", "Plumbers", "Chippies", "Concreters", "Roofers", "Painters"];

export default function Home() {
  return (
    <main className="bg-[#0a1722] text-white overflow-hidden">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pt-6 flex items-center justify-between">
        <span className="font-display text-xl tracking-wide text-white">QUOTEASE</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-[#a9bcc8] hover:text-white font-semibold text-sm transition-colors">
            Log in
          </Link>
          <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-sm px-5 py-2.5 rounded-lg hover:bg-[#e89e00] transition-colors">
            Start free trial
          </Link>
        </div>
      </div>

      {/* ── HERO ────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pt-14 pb-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
        <div>
          <div className="inline-flex items-center gap-2.5 mb-6">
            <span className="w-7 h-2 block rounded-sm" style={{ background: "repeating-linear-gradient(135deg,#FFB400 0 6px,#0A1722 6px 12px)" }} />
            <span className="font-bold text-xs tracking-[.2em] uppercase text-[#ffb400]">Quoting software for trades</span>
          </div>
          <h1 className="font-display uppercase text-[3rem] sm:text-[4.2rem] leading-[0.93] mb-6 text-white">
            Quote the job before you&apos;ve left the <span className="text-[#ffb400]">driveway</span>
          </h1>
          <p className="text-[17px] leading-[1.6] text-[#a9bcc8] max-w-[500px] mb-8">
            Fill in what you see on site, get a real number on the spot, and send it before the
            next tradie even calls the client back.
          </p>
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-base px-7 py-4 rounded-xl hover:bg-[#e89e00] transition-colors"
              style={{ boxShadow: "0 10px 30px rgba(255,180,0,.25)" }}>
              Start free trial
            </Link>
            <Link href="/login" className="text-white font-bold text-base px-6 py-4 rounded-xl border border-white/20 hover:border-white/40 transition-colors">
              Log in
            </Link>
          </div>
          <div className="flex items-center gap-5 flex-wrap text-[#7e94a2] text-[13.5px] font-semibold">
            <span className="flex items-center gap-2"><span className="text-[#ffb400]">✓</span> 7-day free trial</span>
            <span className="flex items-center gap-2"><span className="text-[#ffb400]">✓</span> $40/mo flat</span>
            <span className="flex items-center gap-2"><span className="text-[#ffb400]">✓</span> Unlimited users</span>
          </div>
        </div>

        {/* Quote docket */}
        <div className="relative">
          <div className="stamp-wobble absolute -top-4 -right-1 z-10 bg-[#ffb400] text-[#0a1722] font-display text-lg tracking-wide px-4 py-2 rounded-md -rotate-[9deg]"
            style={{ boxShadow: "0 8px 22px rgba(0,0,0,.35)" }}>
            QUOTED
          </div>
          <div className="bg-[#f6f9fb] text-[#14202b] rounded-2xl px-7 pt-7 pb-6 -rotate-[1.4deg]"
            style={{ boxShadow: "0 30px 70px rgba(0,0,0,.5)" }}>
            <div className="flex items-baseline justify-between border-b-2 border-[#14202b] pb-3 mb-4">
              <span className="font-display text-xl text-[#14202b]">QUOTE No. 0001</span>
              <span className="text-[11px] font-extrabold tracking-wide text-[#1B8A4B] bg-[#DBF3E4] px-2.5 py-1 rounded-full">● SENT</span>
            </div>
            <div className="font-extrabold text-[15px] mb-4 text-[#33464F]">Residential rewire — Brunswick</div>
            {QUOTE_ITEMS.map((it) => (
              <div key={it.label} className="flex items-center justify-between py-3 border-b border-dashed border-[#C9D6DE] text-[14px]">
                <span className="text-[#3C515B] font-semibold">{it.label}</span>
                <span className="font-extrabold tabular text-[#14202b]">{it.val}</span>
              </div>
            ))}
            <div className="flex items-center justify-between mt-4">
              <span className="font-display text-[22px] text-[#14202b]">TOTAL</span>
              <span className="font-display text-[34px] bg-[#ffb400] text-[#0a1722] px-3 rounded-lg">$1,840</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── TRADE STRIP ─────────────────────────────────────── */}
      <div className="border-t border-b border-white/[0.08] bg-[#0c1e2e]">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-8 flex-wrap justify-center text-[#6f8593] font-bold text-[13px] tracking-widest uppercase">
          {TRADES.map((t, i) => (
            <span key={t} className="flex items-center gap-8">
              {t}
              {i < TRADES.length - 1 && <span className="opacity-30">/</span>}
            </span>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-10">
        <div className="flex items-end justify-between gap-6 mb-12 flex-wrap">
          <h2 className="font-display uppercase text-[2.5rem] sm:text-[3rem] leading-[0.95] max-w-[600px] text-white">
            From the front gate to <span className="text-[#ffb400]">&ldquo;yep, send it&rdquo;</span> in four steps
          </h2>
          <span className="text-[#7e94a2] font-semibold text-sm max-w-[280px]">
            No training day. No onboarding call. Open it, pick your trade, start quoting.
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-[#0e2233] border border-white/[0.08] rounded-2xl px-6 pt-6 pb-7">
              <div className="font-display text-[44px] leading-none mb-5" style={{ color: "transparent", WebkitTextStroke: "1.5px #FFB400" }}>
                {s.n}
              </div>
              <div className="font-extrabold text-[17px] mb-2 text-white">{s.title}</div>
              <div className="text-[#92a6b3] text-[14px] leading-[1.55]">{s.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-10">
        <div className="grid sm:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.tag} className="bg-[#0e2233] border border-white/[0.08] border-t-[3px] border-t-[#ffb400] rounded-2xl px-7 pt-8 pb-8">
              <div className="font-bold text-xs tracking-[.16em] uppercase text-[#ffb400] mb-4">{f.tag}</div>
              <h3 className="font-display uppercase text-[26px] leading-[1.04] mb-3 text-white">{f.title}</h3>
              <p className="text-[#92a6b3] text-[14.5px] leading-[1.6]">{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── BUILT ON SITE ───────────────────────────────────── */}
      <div className="bg-[#0c1e2e] border-t border-white/[0.08] mt-16">
        <div className="max-w-6xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2.5 mb-5">
              <span className="w-7 h-2 block rounded-sm" style={{ background: "repeating-linear-gradient(135deg,#FFB400 0 6px,#0C1E2E 6px 12px)" }} />
              <span className="font-bold text-xs tracking-[.2em] uppercase text-[#ffb400]">Built on site</span>
            </div>
            <h2 className="font-display uppercase text-[2.3rem] sm:text-[2.75rem] leading-[0.98] mb-5 text-white">
              Quote with muddy boots on, not back at the office
            </h2>
            <p className="text-[#a9bcc8] text-[16px] leading-[1.65] mb-7 max-w-[460px]">
              Tap through fields built for the job in front of you. The number lands as you go —
              so the client gets a price while you&apos;re still standing in their driveway.
            </p>
            <div className="flex flex-col gap-3.5">
              {["Live total updates as you add line items", "Access & difficulty multipliers baked in", "Send straight from your phone"].map((line) => (
                <div key={line} className="flex items-center gap-3 font-semibold text-[15px] text-[#d5e0e7]">
                  <span className="text-[#ffb400] font-extrabold">→</span> {line}
                </div>
              ))}
            </div>
          </div>

          {/* Phone mockup */}
          <div className="flex justify-center">
            <div className="w-[290px] bg-[#0a1722] border-[10px] border-[#1a2c3a] rounded-[38px] px-4 pt-4 pb-5"
              style={{ boxShadow: "0 40px 80px rgba(0,0,0,.5)" }}>
              <div className="flex justify-center mb-3">
                <span className="w-20 h-1.5 bg-[#1a2c3a] rounded-full block" />
              </div>
              <div className="bg-[#f6f9fb] rounded-[20px] p-4 text-[#14202b]">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-extrabold text-[13px] text-[#14202b]">New quote</span>
                  <span className="text-[10px] font-extrabold tracking-wide text-[#0a1722] bg-[#ffb400] px-2 py-1 rounded-full">ELECTRICAL</span>
                </div>
                <div className="bg-white border border-[#e2eaef] rounded-xl p-3 mb-2">
                  <div className="text-[11px] text-[#7b8c95] font-bold mb-1">SWITCHBOARD UPGRADE</div>
                  <div className="flex justify-between"><span className="text-xs text-[#56676f]">Qty 1</span><span className="font-extrabold text-sm text-[#14202b]">$380</span></div>
                </div>
                <div className="bg-white border border-[#e2eaef] rounded-xl p-3 mb-2">
                  <div className="text-[11px] text-[#7b8c95] font-bold mb-1">DOWNLIGHTS</div>
                  <div className="flex justify-between"><span className="text-xs text-[#56676f]">Qty 12</span><span className="font-extrabold text-sm text-[#14202b]">$420</span></div>
                </div>
                <div className="border border-dashed border-[#c9d6de] rounded-xl p-3 text-center text-[#e89e00] font-extrabold text-[12px] bg-[#fffbf0]">+ Add line item</div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-[#14202b]">
                  <span className="font-display text-[14px] text-[#14202b]">RUNNING TOTAL</span>
                  <span className="font-display text-[20px] text-[#14202b]">$1,840</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PRICING ─────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <span className="font-bold text-xs tracking-[.2em] uppercase text-[#ffb400]">Pricing</span>
          <h2 className="font-display uppercase text-[2.5rem] sm:text-[3rem] mt-4 text-white">One price. No per-seat nonsense.</h2>
        </div>
        <div className="max-w-[480px] mx-auto bg-[#0e2233] border border-white/[0.1] rounded-2xl overflow-hidden"
          style={{ boxShadow: "0 30px 70px rgba(0,0,0,.4)" }}>
          <div className="h-2.5" style={{ background: "repeating-linear-gradient(135deg,#FFB400 0 14px,#E89E00 14px 28px)" }} />
          <div className="p-10 text-center">
            <div className="flex items-end justify-center gap-1.5 mb-2">
              <span className="font-display text-[5rem] leading-[0.85] text-[#ffb400]">$40</span>
              <span className="font-extrabold text-xl text-[#a9bcc8] pb-3">/mo flat</span>
            </div>
            <p className="text-[#92a6b3] font-semibold text-[15px] mb-7">Unlimited users · no per-seat fees · cancel anytime</p>
            <Link href="/signup" className="block bg-[#ffb400] text-[#0a1722] font-extrabold text-[17px] py-4 rounded-xl mb-3 hover:bg-[#e89e00] transition-colors">
              Start your 7-day free trial
            </Link>
            <span className="text-[#6f8593] text-[13px]">Then $40/mo. Cancel anytime.</span>
          </div>
        </div>
      </div>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <div className="bg-[#0c1e2e] border-t border-white/[0.08]">
        <div className="max-w-[820px] mx-auto px-6 py-24">
          <h2 className="font-display uppercase text-[2.4rem] sm:text-[2.75rem] mb-10 text-center text-white">Straight answers</h2>
          <div className="flex flex-col gap-4">
            {FAQS.map((qa) => (
              <div key={qa.q} className="bg-[#0e2233] border border-white/[0.07] border-l-[3px] border-l-[#ffb400] rounded-xl px-6 py-6">
                <div className="font-extrabold text-[17px] mb-2 text-white">{qa.q}</div>
                <div className="text-[#92a6b3] text-[15px] leading-[1.6]">{qa.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FOOTER CTA ──────────────────────────────────────── */}
      <div className="bg-[#ffb400] text-[#0a1722]">
        <div className="max-w-6xl mx-auto px-6 py-20 flex items-center justify-between gap-8 flex-wrap">
          <div>
            <h2 className="font-display uppercase text-[2.5rem] sm:text-[3.1rem] leading-[0.95] mb-2 text-[#0a1722]">
              Beat the other tradie<br />to the quote
            </h2>
            <p className="font-bold text-base text-[#0a1722]/70">7-day free trial · $40/mo flat · unlimited users</p>
          </div>
          <Link href="/signup" className="bg-[#0a1722] text-[#ffb400] font-extrabold text-lg px-9 py-5 rounded-xl whitespace-nowrap hover:bg-[#0e2233] transition-colors">
            Start free trial →
          </Link>
        </div>
        <div className="border-t border-black/[0.15]">
          <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between flex-wrap gap-3">
            <span className="font-display text-lg text-[#0a1722]">QUOTEASE</span>
            <span className="font-bold text-[13px] text-[#0a1722]/70">Quoting software built by tradies, for tradies.</span>
          </div>
        </div>
      </div>

    </main>
  );
}
