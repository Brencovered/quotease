export default function BillingPanel() {
  return (
    <main className="max-w-sm mx-auto px-4 sm:px-6 py-16 text-center">
      <h1 className="font-display text-2xl text-[var(--ink)] mb-3">Free during early access</h1>
      <p className="text-[14px] text-[var(--ink-faint)] leading-relaxed mb-6">
        Quotease isn&apos;t charging anyone right now while we&apos;re still building this out. No card,
        no trial countdown, nothing to manage here.
      </p>
      <p className="text-[13px] text-[var(--ink-faint)] leading-relaxed">
        In exchange, we&apos;ll be reaching out for feedback from time to time — and if it&apos;s working
        well for you, we&apos;d love a testimonial down the track.
      </p>
    </main>
  );
}
