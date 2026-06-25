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
      <main className="max-w-sm mx-auto px-6 py-16">
        <h1 className="text-xl font-medium mb-4">Billing</h1>
        <div className="border rounded-lg p-4 mb-4">
          <p className="text-sm font-medium">
            {isTrialing ? "Free trial active" : "Subscription active"}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            Plan: {profile!.subscription_plan === "annual" ? "Annual ($400/yr)" : "Monthly ($40/mo)"}
          </p>
          {isTrialing && profile!.trial_ends_at && (
            <p className="text-sm text-neutral-500">
              Trial ends {new Date(profile!.trial_ends_at).toLocaleDateString()}
            </p>
          )}
          {!isTrialing && profile!.current_period_end && (
            <p className="text-sm text-neutral-500">
              Renews {new Date(profile!.current_period_end).toLocaleDateString()}
            </p>
          )}
        </div>
        <button
          onClick={openPortal}
          disabled={loading === "portal"}
          className="w-full border rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading === "portal" ? "Opening..." : "Manage billing"}
        </button>
        <button onClick={() => router.push("/electrician")} className="w-full text-sm text-blue-600 mt-3">
          Back to quotes
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-sm mx-auto px-6 py-16">
      <h1 className="text-xl font-medium mb-2">Start your 7-day free trial</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Unlimited users on every plan. Cancel anytime during the trial and you won&apos;t be charged.
      </p>

      <button
        onClick={() => startCheckout("monthly")}
        disabled={loading !== null}
        className="w-full border-2 border-blue-500 bg-blue-50 rounded-lg p-4 text-left mb-3 disabled:opacity-50"
      >
        <p className="font-medium text-blue-900">Monthly — $40/mo</p>
        <p className="text-xs text-blue-700">Unlimited users, billed monthly</p>
      </button>

      <button
        onClick={() => startCheckout("annual")}
        disabled={loading !== null}
        className="w-full border rounded-lg p-4 text-left disabled:opacity-50"
      >
        <p className="font-medium">Annual — $400/yr</p>
        <p className="text-xs text-neutral-500">Equivalent to $33.33/mo — 2 months free</p>
      </button>

      {loading && <p className="text-sm text-neutral-500 mt-4">Redirecting to checkout...</p>}
    </main>
  );
}
