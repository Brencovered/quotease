import Link from "next/link";

const QUOTE_ITEMS = [
  { label: "Switchboard upgrade", val: "$380" },
  { label: "Power points × 6", val: "$312" },
  { label: "Downlights × 12", val: "$420" },
  { label: "Roof access — tight crawl", val: "×1.7" },
];

const STEPS = [
  { n: "01", title: "Pick your trades", body: "Set it up once. Every job after uses fields built for how you actually work." },
  { n: "02", title: "Fill in what you see", body: "Tap through fields made for the job in front of you — no generic form." },
  { n: "03", title: "Get a real number", body: "It calculates off your own supplier pricing, not a guess." },
  { n: "04", title: "Send it & get paid", body: "Email the quote, set deposit terms, track what's outstanding." },
];

const FEATURES = [
  { tag: "Trade", title: "Built for your trade", body: "Pick your trades once. Every job after that uses fields built for how you actually work — not a generic form bolted onto a scheduling app." },
  { tag: "Materials", title: "Your real prices", body: "Upload your own supplier pricing. The quote calculates off what you actually pay, not a guess." },
  { tag: "Payment", title: "Send it, track it, get paid", body: "Email the quote straight to the client. Set payment terms — deposit up front, balance on completion — and see what's still outstanding." },
];

const FAQS = [
  { q: "Is it really $40 a month, flat?", a: "One price. Unlimited users, no per-seat fees, cancel anytime." },
  { q: "Do I need to be techy?", a: "No. If you can take a photo on site, you can build a quote." },
  { q: "Can I use my own supplier pricing?", a: "Upload your price list and every quote calculates off what you actually pay." },
  { q: "What trades is it for?", a: "Sparkies, plumbers, chippies and more — pick your trades and the fields fit how you work." },
  { q: "Is there a free trial?", a: "Seven days free, unlimited users, cancel anytime. Start quoting today." },
];

const TRADES = ["Sparkies", "Plumbers", "Chippies", "Concreters", "Roofers", "Painters"];

export default function Home() {
  return (
    <main className="bg-[var(--navy)] overflow-hidden">
      {/* NAV */}
      <div className="max-w-6xl mx-auto px-6 pt-6 flex items-center justify-between">
        <span className="font-display text-xl tracking-wide">QUOTEASE</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-[var(--steel-1)] font-semibold text-sm">
            Log in
          </Link>
          <Link href="/signup" className="bg-[var(--amber)] text-[var(--navy)] font-extrabold text-sm px-[18px] py-[10px] rounded-md">
            Start free trial
          </Link>
        </div>
      </div>

      {/* HERO */}
      <div className="max-w-6xl mx-auto px-6 pt-14 pb-[70px] grid lg:grid-cols-[1.05fr_0.95fr] gap-[52px] items-center">
        <div className="reveal">
          <div className="inline-flex items-center gap-[10px] mb-[22px]">
            <span
              className="w-[30px] h-2 block"
              style={{ background: "repeating-linear-gradient(135deg,#FFB400 0 6px,#0A1722 6px 12px)" }}
            />
            <span className="font-bold text-xs tracking-[.2em] uppercase text-[var(--amber)]">
              Quoting software for trades
            </span>
          </div>
          <h1 className="font-display uppercase text-[3.2rem] sm:text-[4.4rem] leading-[0.92] mb-[22px]">
            Quote the job before you&apos;ve left the <span className="text-[var(--amber)]">driveway</span>
          </h1>
          <p className="text-lg leading-[1.55] text-[var(--steel-1)] max-w-[520px] mb-[30px]">
            Fill in what you see on site, get a real number on the spot, and send it before the
            next tradie even calls the client back. No per-user fees, no bloated job-management
            suite you&apos;ll never touch.
          </p>
          <div className="flex items-center gap-[14px] mb-[22px] flex-wrap">
            <Link
              href="/signup"
              className="bg-[var(--amber)] text-[var(--navy)] font-extrabold text-base px-[26px] py-[15px] rounded-[7px]"
              style={{ boxShadow: "0 10px 30px rgba(255,180,0,.22)" }}
            >
              Start free trial
            </Link>
            <Link
              href="/login"
              className="text-[var(--text)] font-bold text-base px-[22px] py-[15px] rounded-[7px] border border-white/[0.18]"
            >
              Log in
            </Link>
          </div>
          <div className="flex items-center gap-[18px] flex-wrap text-[var(--steel-3)] text-[13.5px] font-semibold">
            <span className="flex items-center gap-[7px]"><span className="text-[var(--amber)]">✓</span> 7-day free trial</span>
            <span className="flex items-center gap-[7px]"><span className="text-[var(--amber)]">✓</span> $40/mo flat</span>
            <span className="flex items-center gap-[7px]"><span className="text-[var(--amber)]">✓</span> Unlimited users</span>
          </div>
        </div>

        {/* QUOTE DOCKET CARD */}
        <div className="reveal relative">
          <div
            className="stamp-wobble absolute -top-[18px] -right-[6px] z-10 bg-[var(--amber)] text-[var(--navy)] font-display text-lg tracking-[.08em] px-4 py-2 rounded-[5px] -rotate-[9deg]"
            style={{ boxShadow: "0 8px 22px rgba(0,0,0,.35)" }}
          >
            QUOTED
          </div>
          <div
            className="bg-[var(--paper)] text-[var(--ink)] rounded-[14px] px-[26px] pt-[26px] pb-6 -rotate-[1.4deg] border border-black/5"
            style={{ boxShadow: "0 30px 70px rgba(0,0,0,.45)" }}
          >
            <div className="flex items-baseline justify-between border-b-2 border-[var(--ink)] pb-3 mb-[14px]">
              <span className="font-display text-xl">QUOTE No. 0001</span>
              <span className="text-[11px] font-extrabold tracking-[.12em] text-[#1B8A4B] bg-[#DBF3E4] px-[9px] py-1 rounded-full">
                ● SENT
              </span>
            </div>
            <div className="font-extrabold text-[15px] mb-4 text-[#33464F]">Residential rewire — Brunswick</div>
            {QUOTE_ITEMS.map((it) => (
              <div key={it.label} className="flex items-center justify-between py-[11px] border-b border-dashed border-[#C9D6DE] text-[14.5px]">
                <span className="text-[#3C515B] font-semibold">{it.label}</span>
                <span className="font-extrabold tabular">{it.val}</span>
              </div>
            ))}
            <div className="flex items-center justify-between mt-4">
              <span className="font-display text-[22px]">TOTAL</span>
              <span className="font-display text-[34px] bg-[var(--amber)] text-[var(--ink)] px-3 rounded-[6px]">$1,840</span>
            </div>
          </div>
        </div>
      </div>

      {/* TRUST STRIP */}
      <div className="border-t border-b border-white/[0.08] bg-[var(--navy-deep)]">
        <div className="reveal max-w-6xl mx-auto px-6 py-5 flex items-center gap-[34px] flex-wrap justify-center text-[var(--steel-4)] font-bold text-[13px] tracking-[.06em] uppercase">
          {TRADES.map((t, i) => (
            <span key={t} className="flex items-center gap-[34px]">
              {t}
              {i < TRADES.length - 1 && <span className="opacity-40">/</span>}
            </span>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="max-w-6xl mx-auto px-6 pt-[90px] pb-[30px]">
        <div className="reveal flex items-end justify-between gap-5 mb-[46px] flex-wrap">
          <h2 className="font-display uppercase text-[2.75rem] sm:text-[3.1rem] leading-[0.95] max-w-[620px]">
            From the front gate to <span className="text-[var(--amber)]">&ldquo;yep, send it&rdquo;</span> in four steps
          </h2>
          <span className="text-[var(--steel-3)] font-semibold text-sm max-w-[300px]">
            No training day. No onboarding call. Open it, pick your trade, start quoting.
          </span>
        </div>
        <div className="reveal grid sm:grid-cols-2 lg:grid-cols-4 gap-[18px]">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-[var(--card)] border border-white/[0.07] rounded-xl px-[22px] pt-6 pb-[26px]">
              <div
                className="font-display text-[42px] leading-none mb-[18px]"
                style={{ color: "transparent", WebkitTextStroke: "1.5px #FFB400" }}
              >
                {s.n}
              </div>
              <div className="font-extrabold text-lg mb-[9px]">{s.title}</div>
              <div className="text-[var(--steel-2)] text-sm leading-[1.5]">{s.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div className="max-w-6xl mx-auto px-6 pt-[70px] pb-[30px]">
        <div className="reveal grid sm:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.tag} className="bg-[var(--card)] border border-white/[0.07] border-t-[3px] border-t-[var(--amber)] rounded-xl px-[26px] pt-[30px] pb-8">
              <div className="font-bold text-xs tracking-[.16em] uppercase text-[var(--amber)] mb-4">{f.tag}</div>
              <h3 className="font-display uppercase text-[27px] leading-[1.02] mb-3">{f.title}</h3>
              <p className="text-[var(--steel-2)] text-[14.5px] leading-[1.6]">{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* VISUAL PROOF */}
      <div className="bg-[var(--navy-deep)] border-t border-white/[0.08] mt-[70px]">
        <div className="max-w-6xl mx-auto px-6 py-[84px] grid lg:grid-cols-2 gap-14 items-center">
          <div className="reveal">
            <div className="inline-flex items-center gap-[10px] mb-5">
              <span className="w-[30px] h-2 block" style={{ background: "repeating-linear-gradient(135deg,#FFB400 0 6px,#0C1E2E 6px 12px)" }} />
              <span className="font-bold text-xs tracking-[.2em] uppercase text-[var(--amber)]">Built on site</span>
            </div>
            <h2 className="font-display uppercase text-[2.4rem] sm:text-[2.875rem] leading-[0.98] mb-[18px]">
              Quote with muddy boots on, not back at the office
            </h2>
            <p className="text-[var(--steel-1)] text-[16.5px] leading-[1.6] mb-[26px] max-w-[480px]">
              Tap through fields built for the job in front of you. The number lands as you go —
              so the client gets a price while you&apos;re still standing in their driveway.
            </p>
            <div className="flex flex-col gap-[13px]">
              {[
                "Live total updates as you add line items",
                "Access & difficulty multipliers baked in",
                "Send straight from your phone",
              ].map((line) => (
                <div key={line} className="flex items-center gap-[11px] font-semibold text-[15px] text-[#D5E0E7]">
                  <span className="text-[var(--amber)] font-extrabold">→</span> {line}
                </div>
              ))}
            </div>
          </div>

          <div className="reveal flex justify-center">
            <div
              className="w-[300px] bg-[var(--navy)] border-[10px] border-[#1A2C3A] rounded-[38px] px-[14px] pt-[14px] pb-5"
              style={{ boxShadow: "0 40px 80px rgba(0,0,0,.5)" }}
            >
              <div className="flex justify-center mb-3">
                <span className="w-[90px] h-[6px] bg-[#1A2C3A] rounded-full block" />
              </div>
              <div className="bg-[var(--paper)] rounded-[18px] p-[18px] text-[var(--ink)]">
                <div className="flex items-center justify-between mb-[14px]">
                  <span className="font-extrabold text-[13px]">New quote</span>
                  <span className="text-[10px] font-extrabold tracking-[.1em] text-[var(--ink)] bg-[var(--amber)] px-2 py-[3px] rounded-full">
                    ELECTRICAL
                  </span>
                </div>
                <div className="bg-white border border-[#E2EAEF] rounded-[10px] p-3 mb-[9px]">
                  <div className="text-[11px] text-[#7B8C95] font-bold mb-1">SWITCHBOARD UPGRADE</div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#56676F]">Qty 1</span>
                    <span className="font-extrabold text-sm">$380</span>
                  </div>
                </div>
                <div className="bg-white border border-[#E2EAEF] rounded-[10px] p-3 mb-[9px]">
                  <div className="text-[11px] text-[#7B8C95] font-bold mb-1">DOWNLIGHTS</div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#56676F]">Qty 12</span>
                    <span className="font-extrabold text-sm">$420</span>
                  </div>
                </div>
                <div className="border border-dashed border-[#C9D6DE] rounded-[10px] p-[11px] text-center text-[var(--amber)] font-extrabold text-[12.5px] bg-[#FFFBF0]">
                  + Add line item
                </div>
                <div className="flex justify-between items-center mt-[14px] pt-3 border-t-2 border-[var(--ink)]">
                  <span className="font-display text-[15px]">RUNNING TOTAL</span>
                  <span className="font-display text-[22px]">$1,840</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div className="max-w-6xl mx-auto px-6 py-[90px]">
        <div className="reveal text-center mb-10">
          <span className="font-bold text-xs tracking-[.2em] uppercase text-[var(--amber)]">Pricing</span>
          <h2 className="font-display uppercase text-[2.75rem] sm:text-[3.1rem] mt-[14px]">
            One price. No per-seat nonsense.
          </h2>
        </div>
        <div
          className="reveal max-w-[520px] mx-auto bg-[var(--card)] border border-white/[0.09] rounded-[18px] overflow-hidden"
          style={{ boxShadow: "0 30px 70px rgba(0,0,0,.4)" }}
        >
          <div className="h-[10px]" style={{ background: "repeating-linear-gradient(135deg,#FFB400 0 14px,#E89E00 14px 28px)" }} />
          <div className="p-10 text-center">
            <div className="flex items-end justify-center gap-[6px] mb-[6px]">
              <span className="font-display text-[5.25rem] leading-[0.8] text-[var(--amber)]">$40</span>
              <span className="font-extrabold text-xl text-[var(--steel-1)] pb-3">/mo flat</span>
            </div>
            <div className="text-[var(--steel-2)] font-semibold text-[15px] mb-[26px]">
              Unlimited users · no per-seat fees · cancel anytime
            </div>
            <Link
              href="/signup"
              className="block bg-[var(--amber)] text-[var(--ink)] font-extrabold text-[17px] py-[17px] rounded-[9px] mb-[14px]"
            >
              Start your 7-day free trial
            </Link>
            <span className="text-[var(--steel-4)] text-[13px]">Then $40/mo. Cancel anytime.</span>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-[var(--navy-deep)] border-t border-white/[0.08]">
        <div className="max-w-[860px] mx-auto px-6 py-[84px]">
          <h2 className="reveal font-display uppercase text-[2.5rem] sm:text-[2.75rem] mb-[38px] text-center">
            Straight answers
          </h2>
          <div className="reveal flex flex-col gap-[14px]">
            {FAQS.map((qa) => (
              <div key={qa.q} className="bg-[var(--card)] border border-white/[0.07] border-l-[3px] border-l-[var(--amber)] rounded-[10px] px-6 py-[22px]">
                <div className="font-extrabold text-[17px] mb-2">{qa.q}</div>
                <div className="text-[var(--steel-2)] text-[15px] leading-[1.6]">{qa.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER CTA */}
      <div className="bg-[var(--amber)] text-[var(--ink)]">
        <div className="reveal max-w-6xl mx-auto px-6 py-[74px] flex items-center justify-between gap-[30px] flex-wrap">
          <div>
            <h2 className="font-display uppercase text-[2.75rem] sm:text-[3.25rem] leading-[0.95] mb-2">
              Beat the other tradie
              <br />
              to the quote
            </h2>
            <p className="font-bold text-base opacity-80">7-day free trial · $40/mo flat · unlimited users</p>
          </div>
          <Link
            href="/signup"
            className="bg-[var(--ink)] text-[var(--amber)] font-extrabold text-lg px-[34px] py-[19px] rounded-[9px] whitespace-nowrap"
          >
            Start free trial →
          </Link>
        </div>
        <div className="border-t border-black/[0.18]">
          <div className="max-w-6xl mx-auto px-6 py-[22px] flex items-center justify-between flex-wrap gap-[10px]">
            <span className="font-display text-lg">QUOTEASE</span>
            <span className="font-bold text-[13px]">Quoting software built by tradies, for tradies.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
