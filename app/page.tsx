import Link from "next/link";

export default function Home() {
  return (
    <main>
      {/* HERO */}
      <section className="bg-[var(--navy)] relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-20 lg:py-28 grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
          <div>
            <p className="font-mono-num text-xs tracking-widest uppercase text-[var(--orange)] mb-5">
              Job type — quoting software for trades
            </p>
            <h1 className="font-display font-medium uppercase text-[var(--off-white)] text-[2.75rem] sm:text-6xl leading-[1.02] tracking-tight mb-6">
              Quote the job
              <br />
              before you've left
              <br />
              the driveway
            </h1>
            <p className="text-lg text-[var(--steel)] max-w-md mb-9 leading-relaxed">
              Fill in what you see on site, get a real number on the spot, and send it before the
              next tradie even calls the client back. No per-user fees, no bloated job-management
              suite you'll never touch.
            </p>
            <div className="flex flex-wrap gap-3 mb-4">
              <Link
                href="/signup"
                className="stamp-press bg-[var(--orange)] hover:bg-[var(--orange-deep)] text-white font-display uppercase tracking-wide text-sm px-7 py-3.5 rounded-sm transition-colors"
              >
                Start free trial
              </Link>
              <Link
                href="/login"
                className="stamp-press border border-[var(--steel)] text-[var(--off-white)] font-display uppercase tracking-wide text-sm px-7 py-3.5 rounded-sm hover:bg-white/5 transition-colors"
              >
                Log in
              </Link>
            </div>
            <p className="font-mono-num text-xs text-[var(--steel)]">
              7-day free trial · $40/mo flat · unlimited users
            </p>
          </div>

          {/* Signature element: the carbon-copy quote docket */}
          <div className="hidden lg:flex justify-center">
            <div
              className="docket-enter docket-perf relative bg-[var(--paper)] text-[var(--ink)] w-[300px] px-7 py-6 rounded-[2px] shadow-2xl"
              style={{ boxShadow: "0 30px 60px -15px rgba(0,0,0,0.5)" }}
            >
              <div
                className="absolute top-5 -right-3 border-2 border-[var(--orange)] text-[var(--orange)] font-display uppercase text-xs px-3 py-1 rotate-12 select-none"
                style={{ opacity: 0.85 }}
              >
                Quoted
              </div>
              <p className="font-mono-num text-[10px] uppercase tracking-widest text-[var(--ink)]/50 mb-1">
                Quote No. 0001
              </p>
              <p className="font-display uppercase text-sm tracking-wide mb-4 border-b border-dashed border-[var(--paper-line)] pb-3">
                Residential rewire — Brunswick
              </p>
              <ul className="space-y-1.5 text-[13px] mb-3">
                <li className="flex justify-between">
                  <span>Switchboard upgrade</span>
                  <span className="font-mono-num">$380</span>
                </li>
                <li className="flex justify-between">
                  <span>Power points × 6</span>
                  <span className="font-mono-num">$312</span>
                </li>
                <li className="flex justify-between">
                  <span>Downlights × 12</span>
                  <span className="font-mono-num">$420</span>
                </li>
                <li className="flex justify-between text-[var(--ink)]/60">
                  <span>Roof access — tight crawl</span>
                  <span className="font-mono-num">×1.7</span>
                </li>
              </ul>
              <div className="flex justify-between items-baseline border-t-2 border-[var(--ink)] pt-3">
                <span className="font-display uppercase text-sm">Total</span>
                <span className="font-mono-num text-xl font-bold">$1,840</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES — styled as docket fields */}
      <section className="bg-[var(--off-white)] border-b border-[var(--paper-line)]">
        <div className="max-w-6xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-10">
          <div>
            <p className="font-mono-num text-xs tracking-widest uppercase text-[var(--orange-deep)] mb-2">
              Trade:
            </p>
            <p className="font-display uppercase text-lg mb-2">Built for your trade</p>
            <p className="text-sm text-[var(--ink)]/70 leading-relaxed">
              Pick your trades once. Every job after that uses fields built for how you actually
              work — not a generic form bolted onto a scheduling app.
            </p>
          </div>
          <div>
            <p className="font-mono-num text-xs tracking-widest uppercase text-[var(--orange-deep)] mb-2">
              Materials:
            </p>
            <p className="font-display uppercase text-lg mb-2">Your real prices</p>
            <p className="text-sm text-[var(--ink)]/70 leading-relaxed">
              Upload your own supplier pricing. The quote calculates off what you actually pay,
              not a guess.
            </p>
          </div>
          <div>
            <p className="font-mono-num text-xs tracking-widest uppercase text-[var(--orange-deep)] mb-2">
              Payment:
            </p>
            <p className="font-display uppercase text-lg mb-2">Send it, track it, get paid</p>
            <p className="text-sm text-[var(--ink)]/70 leading-relaxed">
              Email the quote straight to the client. Set payment terms — deposit up front,
              balance on completion — and see what's still outstanding.
            </p>
          </div>
        </div>
      </section>

      {/* PRICING — styled as a receipt line item */}
      <section className="bg-[var(--navy)]">
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <p className="font-mono-num text-xs tracking-widest uppercase text-[var(--orange)] mb-6">
            Pricing
          </p>
          <div className="flex items-baseline justify-between border-b border-dashed border-[var(--steel)]/40 pb-4 mb-2">
            <span className="font-display uppercase text-[var(--off-white)] text-base">
              Quotease subscription
            </span>
            <span className="font-mono-num text-[var(--off-white)] text-2xl font-bold">$40/mo</span>
          </div>
          <p className="text-sm text-[var(--steel)] mb-10">
            Unlimited users · no per-seat fees · cancel anytime
          </p>
          <Link
            href="/signup"
            className="stamp-press inline-block bg-[var(--orange)] hover:bg-[var(--orange-deep)] text-white font-display uppercase tracking-wide text-sm px-8 py-4 rounded-sm transition-colors"
          >
            Start your 7-day free trial
          </Link>
        </div>
      </section>
    </main>
  );
}
