"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WinCelebration from "./WinCelebration";

export default function JobActionsBar({
  quoteId,
  status,
  totalCost,
  amountPaid,
  hasClientEmail,
  completedAt,
}: {
  quoteId: string;
  status: string;
  totalCost: number;
  amountPaid: number;
  hasClientEmail: boolean;
  completedAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payVal, setPayVal] = useState("");

  const owing = Math.max(totalCost - amountPaid, 0);

  async function updateStatus(body: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/quotes/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId, ...body }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setMessage("Something went wrong - try again.");
  }

  async function resend() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/quotes/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok) {
      setMessage("Sent.");
      router.refresh();
    } else {
      setMessage(body.error ?? "Failed to send.");
    }
  }

  function acceptWithCelebration() {
    setCelebrating(true);
    setTimeout(() => updateStatus({ status: "accepted" }), 1100);
  }

  return (
    <div className="card">
      {celebrating && <WinCelebration amount={totalCost} />}
      <p className="section-tag mb-3">Actions</p>
      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <>
            <button onClick={resend} disabled={busy || !hasClientEmail} className="btn-primary text-[13px] py-2 px-4">
              {busy ? "Sending..." : "Send to client"}
            </button>
            {!hasClientEmail && <span className="text-[12px] text-[var(--ink-faint)] self-center">Add a client email to send</span>}
          </>
        )}

        {status === "sent" && (
          <>
            <button onClick={resend} disabled={busy} className="btn-secondary text-[13px] py-2 px-4">
              Resend
            </button>
            <button onClick={acceptWithCelebration} disabled={busy} className="btn-primary text-[13px] py-2 px-4">
              Mark accepted
            </button>
            <button onClick={() => updateStatus({ status: "declined" })} disabled={busy} className="text-[13px] font-semibold text-[var(--red)] border-2 border-[var(--line)] rounded-lg py-2 px-4">
              Mark declined
            </button>
          </>
        )}

        {status === "accepted" && (
          <>
            {!completedAt && (
              <button onClick={() => updateStatus({ completeJob: true })} disabled={busy} className="btn-secondary text-[13px] py-2 px-4">
                Mark job complete
              </button>
            )}
            {owing > 0 && (
              payOpen ? (
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    autoFocus
                    value={payVal}
                    onChange={(e) => setPayVal(e.target.value)}
                    placeholder={`up to ${owing}`}
                    className="app-field text-[13px] py-2 w-28"
                  />
                  <button
                    onClick={async () => {
                      await updateStatus({ paymentAmount: Math.min(Number(payVal) || 0, owing) });
                      setPayOpen(false);
                      setPayVal("");
                    }}
                    disabled={busy}
                    className="btn-primary text-[13px] py-2 px-4"
                  >
                    Save
                  </button>
                </span>
              ) : (
                <button onClick={() => { setPayOpen(true); setPayVal(String(owing)); }} className="btn-secondary text-[13px] py-2 px-4">
                  Record payment (${owing.toLocaleString()} owing)
                </button>
              )
            )}
          </>
        )}

        {status === "paid" && <span className="text-[13px] text-[var(--green)] font-semibold">Paid in full</span>}
      </div>
      {message && <p className="text-[12.5px] text-[var(--ink-faint)] mt-2">{message}</p>}
    </div>
  );
}
