"use client";

import { useState } from "react";

export default function BillingPanel({ trialEndsAt, isSubscribed }: { trialEndsAt: string | null; isSubscribed: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;
  const trialExpired = !!trialEndsAt && trialDaysLeft === 0 && !isSubscribed;

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "monthly" }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      setError(data.error ?? "Couldn't start checkout - try again or contact support.");
    } catch {
      setError("Couldn't reach checkout - check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="billing-page-wrap max-w-sm mx-auto px-4 sm:px-6 py-16 text-center">
      <h1 className="font-display text-2xl text-[var(--ink)] mb-3">Your plan</h1>
      <div className="bg-[var(--navy)] rounded-2xl p-6 mb-6">
        <p className="text-[11px] font-bold tracking-[.16em] uppercase text-[var(--steel-3)] mb-1">
          {isSubscribed ? "Current plan" : trialExpired ? "Trial ended" : "Free trial"}
        </p>
        <p className="font-display text-[2.5rem] text-[var(--amber)] leading-tight">$45</p>
        <p className="text-[var(--steel-2)] text-[14px] mb-1">per month</p>
        <p className="text-[12px] text-[var(--steel-3)]">Unlimited seats, quotes and jobs</p>
      </div>

      {isSubscribed ? (
        <p className="text-[14px] text-[var(--ink-faint)] leading-relaxed mb-4">
          You&apos;re subscribed - $45/month, cancel any time, no lock-in.
        </p>
      ) : trialExpired ? (
        <p className="text-[14px] text-[var(--ink-faint)] leading-relaxed mb-4">
          Your 3-day free trial has ended. Subscribe to keep quoting - no setup, cancel any time.
        </p>
      ) : (
        <p className="text-[14px] text-[var(--ink-faint)] leading-relaxed mb-4">
          You&apos;re on a free trial, {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left. No credit card needed until then.
        </p>
      )}

      {!isSubscribed && (
        <>
          <button onClick={startCheckout} disabled={loading} className="btn-primary w-full mb-4">
            {loading ? "Redirecting..." : "Subscribe - $45/month"}
          </button>
          {error && <p className="text-[13px] text-[var(--red)] mb-4">{error}</p>}
        </>
      )}

      <p className="text-[13px] text-[var(--ink-faint)] leading-relaxed">
        Questions about billing? Contact us at{" "}
        <a href="mailto:hello@swiftscope.com.au" className="font-semibold text-[var(--navy)] underline">
          hello@swiftscope.com.au
        </a>
      </p>
    </main>
  );
}
