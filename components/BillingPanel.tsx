export default function BillingPanel() {
  return (
    <main className="billing-page-wrap max-w-sm mx-auto px-4 sm:px-6 py-16 text-center">
      <h1 className="font-display text-2xl text-[var(--ink)] mb-3">Your plan</h1>
      <div className="bg-[var(--navy)] rounded-2xl p-6 mb-6">
        <p className="text-[11px] font-bold tracking-[.16em] uppercase text-[var(--steel-3)] mb-1">Current plan</p>
        <p className="font-display text-[2.5rem] text-[var(--amber)] leading-tight">$39</p>
        <p className="text-[var(--steel-2)] text-[14px] mb-1">per month</p>
        <p className="text-[12px] text-[var(--steel-3)]">Unlimited seats, quotes and jobs</p>
      </div>
      <p className="text-[14px] text-[var(--ink-faint)] leading-relaxed mb-4">
        You are on a 3-day free trial. No credit card needed until your trial ends.
        After that it is $39/month — cancel any time, no lock-in.
      </p>
      <p className="text-[13px] text-[var(--ink-faint)] leading-relaxed">
        To manage your subscription or update payment details, contact us at{" "}
        <a href="mailto:hello@swiftscope.com.au" className="font-semibold text-[var(--navy)] underline">
          hello@swiftscope.com.au
        </a>
      </p>
    </main>
  );
}
