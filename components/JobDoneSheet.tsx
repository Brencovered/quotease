"use client";

import { useEffect, useState } from "react";

export type DoneNextStep = "invoice" | "cash" | "sign_off" | "later";

/**
 * One sheet for Done: confirm hours (honest time), then optional owner next step.
 * Field workers only see hours; owners see invoice / cash / later.
 */
export default function JobDoneSheet({
  open,
  suggestedHours,
  owing,
  canManageMoney,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  suggestedHours: number | null;
  owing: number;
  canManageMoney: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (opts: { hours: number | null; next: DoneNextStep; cashAmount?: number }) => void;
}) {
  const [hours, setHours] = useState("");
  const [skipTime, setSkipTime] = useState(false);
  const [next, setNext] = useState<DoneNextStep>("later");
  const [cash, setCash] = useState("");

  useEffect(() => {
    if (!open) return;
    setHours(suggestedHours != null ? String(suggestedHours) : "");
    setSkipTime(suggestedHours == null);
    setNext(canManageMoney && owing > 0 ? "invoice" : "later");
    setCash(owing > 0 ? String(owing) : "");
  }, [open, suggestedHours, canManageMoney, owing]);

  if (!open) return null;

  const hoursNum = Number(hours);
  const hoursOk = skipTime || (Number.isFinite(hoursNum) && hoursNum >= 0.25 && hoursNum <= 24);

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-3" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl p-4 sm:p-5">
        <p className="section-tag mb-1">Finish job</p>
        <p className="font-semibold text-[var(--ink)] mb-3">Confirm time before it logs</p>

        <label className="flex items-center gap-2 mb-3 text-[13px] text-[var(--ink-soft)]">
          <input type="checkbox" checked={skipTime} onChange={(e) => setSkipTime(e.target.checked)} />
          Don&apos;t log time
        </label>

        {!skipTime && (
          <label className="block mb-4">
            <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1.5">Hours on this job</span>
            <input
              type="number"
              min={0.25}
              max={24}
              step={0.25}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="app-field w-32"
              inputMode="decimal"
            />
            {suggestedHours != null && (
              <span className="ml-2 text-[12px] text-[var(--ink-faint)]">Suggested from Start</span>
            )}
          </label>
        )}

        {canManageMoney && (
          <div className="mb-4 space-y-2">
            <p className="text-[12px] font-medium text-[var(--ink-soft)]">Next</p>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  { id: "invoice" as const, label: "Open invoice PDF", show: true },
                  { id: "cash" as const, label: "Record payment", show: owing > 0 },
                  { id: "sign_off" as const, label: "Awaiting sign-off", show: true },
                  { id: "later" as const, label: "Done for now", show: true },
                ] as const
              )
                .filter((o) => o.show)
                .map((o) => (
                  <label
                    key={o.id}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] cursor-pointer ${
                      next === o.id ? "border-[var(--navy)] bg-[var(--app-bg)] font-semibold" : "border-[var(--line)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="done-next"
                      className="sr-only"
                      checked={next === o.id}
                      onChange={() => setNext(o.id)}
                    />
                    {o.label}
                  </label>
                ))}
            </div>
            {next === "cash" && (
              <label className="block pt-1">
                <span className="block text-[12px] text-[var(--ink-faint)] mb-1">Amount (owing ${owing.toLocaleString()})</span>
                <input type="number" min={0} value={cash} onChange={(e) => setCash(e.target.value)} className="app-field w-36" />
              </label>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary text-[13px] py-2 px-3">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !hoursOk}
            onClick={() =>
              onConfirm({
                hours: skipTime ? null : hoursNum,
                next: canManageMoney ? next : "later",
                cashAmount: next === "cash" ? Number(cash) || undefined : undefined,
              })
            }
            className="btn-primary text-[13px] py-2 px-3"
          >
            {busy ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
