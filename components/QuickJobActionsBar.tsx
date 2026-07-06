"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WinCelebration from "./WinCelebration";

export default function QuickJobActionsBar({
  jobId,
  status,
  totalCost,
  amountPaid,
  completedAt,
}: {
  jobId: string;
  status: string;
  totalCost: number;
  amountPaid: number;
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
    const res = await fetch("/api/jobs/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, ...body }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setMessage("Something went wrong - try again.");
  }

  function completeWithCelebration() {
    setCelebrating(true);
    setTimeout(() => updateStatus({ completeJob: true }), 1100);
  }

  return (
    <div className="card">
      {celebrating && <WinCelebration amount={totalCost} />}
      <p className="section-tag mb-3">Actions</p>
      <div className="flex flex-wrap gap-2">
        {status !== "complete" && status !== "invoiced" && status !== "archived" && status !== "cancelled" && (
          <>
            {status === "scheduled" && (
              <button onClick={() => updateStatus({ status: "in_progress" })} disabled={busy} className="btn-secondary text-[13px] py-2 px-4">
                Mark in progress
              </button>
            )}
            {!completedAt && (
              <button onClick={completeWithCelebration} disabled={busy} className="btn-secondary text-[13px] py-2 px-4">
                Mark job complete
              </button>
            )}
          </>
        )}

        {owing > 0 && status !== "archived" && status !== "cancelled" && (
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

        {(status === "invoiced" || (owing <= 0 && amountPaid > 0)) && <span className="text-[13px] text-[var(--green)] font-semibold">Paid in full</span>}
      </div>
      {message && <p className="text-[12.5px] text-[var(--ink-faint)] mt-2">{message}</p>}
    </div>
  );
}
