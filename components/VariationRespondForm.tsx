"use client";

import { useState } from "react";

export default function VariationRespondForm({
  token,
  title,
  amount,
}: {
  token: string;
  title: string;
  amount: number;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "declined" | null>(null);

  async function respond(action: "approve" | "decline") {
    if (action === "approve" && !name.trim()) {
      setError("Enter your name before approving");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/variations/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, signerName: name.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong");
      setDone(action === "approve" ? "approved" : "declined");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (done === "approved") {
    return (
      <div className="bg-green-50 border border-green-100 rounded-xl px-5 py-4 text-center">
        <p className="font-bold text-green-800">Variation approved</p>
        <p className="text-[13px] text-green-700 mt-1">
          Thanks - {title} (+${amount.toLocaleString()}) is now on the job.
        </p>
      </div>
    );
  }
  if (done === "declined") {
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 text-center">
        <p className="font-bold text-red-800">Variation declined</p>
        <p className="text-[13px] text-red-700 mt-1">The tradie has been notified.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="block text-[13px] font-semibold text-[#3a4a58] mb-1.5">Your name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="w-full border border-[#d5dce1] rounded-xl px-4 py-3 text-[15px]"
          disabled={busy}
        />
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => respond("approve")}
          className="flex-1 bg-[#0a1722] text-white font-bold rounded-xl py-3 px-4 disabled:opacity-50"
        >
          {busy ? "Saving..." : `Approve (+$${amount.toLocaleString()})`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => respond("decline")}
          className="flex-1 border-2 border-[#d5dce1] text-[#0a1722] font-bold rounded-xl py-3 px-4 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
    </div>
  );
}
