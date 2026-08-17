"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WinCelebration from "./WinCelebration";

/**
 * Actions for quote-sourced jobs. When `jobId` is present (job detail),
 * complete/payment go through the jobs API so board status and amount_paid
 * stay aligned. Pre-accept quote actions still use the quotes API.
 */
export default function JobActionsBar({
  quoteId,
  jobId,
  status,
  jobStatus,
  totalCost,
  amountPaid,
  hasClientEmail,
  completedAt,
}: {
  quoteId: string;
  jobId?: string | null;
  /** Quote lifecycle status (draft/sent/accepted/paid). */
  status: string;
  /** Board/job status when on a job detail page. */
  jobStatus?: string | null;
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
  const showJobOps = Boolean(jobId) && (status === "accepted" || status === "paid" || Boolean(jobStatus));

  async function updateQuoteStatus(body: Record<string, unknown>) {
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

  async function updateJobStatus(body: Record<string, unknown>) {
    if (!jobId) return updateQuoteStatus(body);
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/jobs/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, ...body }),
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
    setTimeout(() => updateQuoteStatus({ status: "accepted" }), 1100);
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
            <button onClick={() => updateQuoteStatus({ status: "declined" })} disabled={busy} className="text-[13px] font-semibold text-[var(--red)] border-2 border-[var(--line)] rounded-lg py-2 px-4">
              Mark declined
            </button>
          </>
        )}

        {showJobOps && (
          <>
            {!completedAt && jobStatus !== "complete" && (
              <button onClick={() => updateJobStatus({ completeJob: true })} disabled={busy} className="btn-secondary text-[13px] py-2 px-4">
                Mark job complete
              </button>
            )}
            {owing > 0 && (
              <button onClick={() => setPayOpen((o) => !o)} disabled={busy} className="btn-primary text-[13px] py-2 px-4">
                Record payment
              </button>
            )}
            {owing <= 0 && amountPaid > 0 && (
              <span className="text-[13px] font-semibold text-[var(--green)] self-center">Paid in full</span>
            )}
          </>
        )}

        {status === "accepted" && !jobId && (
          <>
            {!completedAt && (
              <button onClick={() => updateQuoteStatus({ completeJob: true })} disabled={busy} className="btn-secondary text-[13px] py-2 px-4">
                Mark job complete
              </button>
            )}
            {owing > 0 && (
              <button onClick={() => setPayOpen((o) => !o)} disabled={busy} className="btn-primary text-[13px] py-2 px-4">
                Record payment
              </button>
            )}
          </>
        )}
      </div>

      {payOpen && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-[12px] text-[var(--ink-faint)] mb-1">Amount (owing ${owing.toLocaleString()})</span>
            <input
              type="number"
              min={0}
              value={payVal}
              onChange={(e) => setPayVal(e.target.value)}
              className="app-field w-36"
              placeholder={String(owing)}
            />
          </label>
          <button
            disabled={busy || !(Number(payVal) > 0)}
            onClick={() => {
              const amount = Number(payVal);
              if (!(amount > 0)) return;
              if (jobId) updateJobStatus({ paymentAmount: amount });
              else updateQuoteStatus({ paymentAmount: amount });
              setPayOpen(false);
              setPayVal("");
            }}
            className="btn-primary text-[13px] py-2 px-4"
          >
            Save payment
          </button>
        </div>
      )}

      {message && <p className="text-[13px] text-[var(--ink-faint)] mt-2">{message}</p>}
    </div>
  );
}
