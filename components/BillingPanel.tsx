"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  subscription_status: string;
  subscription_plan: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
} | null;

const ACTIVE_STATUSES = ["trialing", "active"];

export default function BillingPanel({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"monthly" | "annual" | "portal" | null>(null);

  const isActive = profile && ACTIVE_STATUSES.includes(profile.subscription_status);

  async function startCheckout(plan: "monthly" | "annual") {
    setLoading(plan);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading(null);
  }

  async function openPortal() {
    setLoading("portal");
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading(null);
  }

  if (isActive) {
    const isTrialing = profile!.subscription_status === "trialing";
    return (
      <main className="max-w-sm mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-display text-2xl text-[var(--ink)] mb-4">Billing</h1>
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-[var(--ink)]">{isTrialing ? "Free trial active" : "Subscription active"}</p>
          <p className="text-sm text-[var(--ink-faint)] mt-1">
            Plan: {profile!.subscription_plan === "annual" ? "Annual ($400/yr)" : "Monthly ($40/mo)"}
          </p>
          {isTrialing && profile!.trial_ends_at && (
            <p className="text-sm text-[var(--ink-faint)]">Trial ends {new Date(profile!.trial_ends_at).toLocaleDateString()}</p>
          )}
          {!isTrialing && profile!.current_period_end && (
            <p className="text-sm text-[var(--ink-faint)]">Renews {new Date(profile!.current_period_end).toLocaleDateString()}</p>
          )}
        </div>
        <button
          onClick={openPortal}
          disabled={loading === "portal"}
          className="w-full border-2 border-[var(--line)] rounded-lg py-3 text-sm font-semibold disabled:opacity-50"
        >
          {loading === "portal" ? "Opening..." : "Manage billing"}
        </button>
        <button onClick={() => router.push("/electrician")} className="w-full text-sm text-[var(--navy)] font-semibold mt-3">
          Back to quotes
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-sm mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-2xl text-[var(--ink)] mb-2">Start your 7-day free trial</h1>
      <p className="text-sm text-[var(--ink-faint)] mb-6">
        Unlimited users on every plan. Cancel anytime during the trial and you won&apos;t be charged.
      </p>

      <button
        onClick={() => startCheckout("monthly")}
        disabled={loading !== null}
        className="w-full border-2 border-[var(--navy)] bg-[var(--app-bg)] rounded-xl p-4 text-left mb-3 disabled:opacity-50"
      >
        <p className="font-semibold text-[var(--ink)]">Monthly — $40/mo</p>
        <p className="text-xs text-[var(--ink-soft)]">Unlimited users, billed monthly</p>
      </button>

      <button
        onClick={() => startCheckout("annual")}
        disabled={loading !== null}
        className="w-full border-2 border-[var(--line)] rounded-xl p-4 text-left disabled:opacity-50"
      >
        <p className="font-semibold text-[var(--ink)]">Annual — $400/yr</p>
        <p className="text-xs text-[var(--ink-faint)]">Equivalent to $33.33/mo — 2 months free</p>
      </button>

      {loading && <p className="text-sm text-[var(--ink-faint)] mt-4">Redirecting to checkout...</p>}
    </main>
  );
}
