"use client";

import { useState } from "react";
import SignaturePad from "@/components/SignaturePad";

export default function DocketSignForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSign = async (signatureData: string) => {
    if (!name.trim()) {
      setError("Enter your name before signing");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/dockets/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedByName: name, signatureData }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Something went wrong");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="bg-green-50 border border-green-100 rounded-xl px-5 py-4 text-center">
        <p className="font-bold text-green-800">Signed</p>
        <p className="text-[13px] text-green-700 mt-1">Thanks - this docket is now on record.</p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-[13px] font-semibold text-[#3a4a58] mb-1.5">Your name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        className="w-full border border-[#d5dce1] rounded-xl px-4 py-3 text-[15px] mb-4"
        disabled={submitting}
      />
      <SignaturePad onSubmit={handleSign} submitLabel={submitting ? "Saving..." : "Sign docket"} disabled={submitting} />
      {error && <p className="text-[13px] text-red-600 mt-2">{error}</p>}
    </div>
  );
}
