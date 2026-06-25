"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

export default function QuoteResponseButtons({ token, status }: { token: string; status: string }) {
  const [current, setCurrent] = useState(status);
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "accept" | "decline") {
    setLoading(action);
    setError(null);
    const res = await fetch(`/api/q/${token}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      setLoading(null);
      return;
    }
    setCurrent(action === "accept" ? "accepted" : "declined");
    setLoading(null);
  }

  if (current === "accepted") {
    return (
      <div className="text-center py-4">
        <CheckCircle2 size={36} className="mx-auto text-green-600 mb-2" />
        <p className="font-bold text-[var(--ink)]">Quote accepted</p>
        <p className="text-[13px] text-[var(--ink-faint)] mt-1">Thanks — they&apos;ll be in touch to schedule the job.</p>
      </div>
    );
  }

  if (current === "declined") {
    return (
      <div className="text-center py-4">
        <p className="font-semibold text-[var(--ink)]">Quote declined</p>
        <p className="text-[13px] text-[var(--ink-faint)] mt-1">No worries — get in touch if anything changes.</p>
      </div>
    );
  }

  if (current === "paid") {
    return (
      <div className="text-center py-4">
        <CheckCircle2 size={36} className="mx-auto text-green-600 mb-2" />
        <p className="font-bold text-[var(--ink)]">This job is paid in full</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-3">
        <button
          onClick={() => respond("accept")}
          disabled={loading !== null}
          className="flex-1 bg-[var(--amber)] text-[var(--navy)] font-bold rounded-lg py-3.5 disabled:opacity-50"
        >
          {loading === "accept" ? "Accepting..." : "Accept quote"}
        </button>
        <button
          onClick={() => respond("decline")}
          disabled={loading !== null}
          className="flex-1 border-2 border-[var(--line)] text-[var(--ink)] font-semibold rounded-lg py-3.5 disabled:opacity-50"
        >
          {loading === "decline" ? "..." : "Decline"}
        </button>
      </div>
      {error && <p className="text-[13px] text-red-600 mt-2 text-center">{error}</p>}
    </div>
  );
}
