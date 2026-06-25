"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, Hammer, Wallet, CheckCircle2 } from "lucide-react";

type PaymentTerm = { label: string; percent: number; trigger: string; days: number };

type Job = {
  id: string;
  client_name: string | null;
  client_email: string | null;
  site_address: string | null;
  job_type: string | null;
  total_cost: number | null;
  amount_paid: number | null;
  payment_terms: PaymentTerm[] | null;
  invoice_number: string | null;
  xero_exported_at: string | null;
  completed_at: string | null;
  accepted_at: string | null;
};

export default function JobsPanel({ jobs: initialJobs }: { jobs: Job[] }) {
  const [jobs] = useState(initialJobs);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [paymentInputId, setPaymentInputId] = useState<string | null>(null);
  const [paymentValue, setPaymentValue] = useState("");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const notExported = jobs.filter((j) => !j.xero_exported_at);

  async function callUpdate(body: Record<string, unknown>) {
    setBusyId(body.quoteId as string);
    const res = await fetch("/api/quotes/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) window.location.reload();
    setBusyId(null);
  }

  async function recordPayment(jobId: string, owing: number) {
    const amount = Number(paymentValue);
    if (!amount || amount <= 0) return;
    await callUpdate({ quoteId: jobId, paymentAmount: Math.min(amount, owing) });
    setPaymentInputId(null);
    setPaymentValue("");
  }

  async function exportToXero() {
    setExporting(true);
    setExportMessage(null);
    const res = await fetch("/api/quotes/export-xero-csv");
    if (res.status === 404) {
      setExportMessage("No jobs ready to export.");
      setExporting(false);
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setExportMessage(body.error ?? "Export failed");
      setExporting(false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xero-import-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportMessage(`Exported ${notExported.length} invoice(s). Import this file in Xero under Business > Invoices > Import.`);
    setExporting(false);
  }

  const totalValue = jobs.reduce((sum, j) => sum + (j.total_cost ?? 0), 0);
  const totalOwing = jobs.reduce((sum, j) => sum + Math.max((j.total_cost ?? 0) - (j.amount_paid ?? 0), 0), 0);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-16">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-[var(--ink)]">Active jobs</h1>
        <Link href="/electrician" className="bg-[var(--amber)] text-[var(--navy)] text-sm font-bold px-4 py-2 rounded-lg">
          New quote
        </Link>
      </div>

      {jobs.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-[var(--navy)] rounded-xl p-4">
            <p className="text-[11px] tracking-[.1em] uppercase text-[var(--steel-3)] font-bold mb-1">Job value</p>
            <p className="font-display text-2xl text-white">${totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4">
            <p className="text-[11px] tracking-[.1em] uppercase text-[var(--ink-faint)] font-bold mb-1">Still owing</p>
            <p className={`font-display text-2xl ${totalOwing > 0 ? "text-red-600" : "text-green-700"}`}>
              ${totalOwing.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5 mb-5">
          <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Xero</p>
          <p className="font-semibold text-[var(--ink)] mb-1">Export to Xero</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-3">
            {notExported.length > 0 ? `${notExported.length} job(s) ready to export.` : "Everything's already been exported."}{" "}
            Downloads a CSV you import directly in Xero.
          </p>
          <button
            onClick={exportToXero}
            disabled={exporting || notExported.length === 0}
            className="bg-[var(--navy)] text-white rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            {exporting ? "Exporting..." : "Export to Xero CSV"}
          </button>
          {exportMessage && <p className="text-[13px] text-[var(--ink-soft)] mt-2">{exportMessage}</p>}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {jobs.length === 0 && (
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-8 text-center">
            <Briefcase size={26} className="mx-auto mb-3 text-[var(--ink-faint)]" />
            <p className="text-[var(--ink-faint)] text-sm">
              No active jobs right now — accepted quotes land here automatically.
            </p>
          </div>
        )}
        {jobs.map((j) => {
          const owing = (j.total_cost ?? 0) - (j.amount_paid ?? 0);
          const stage = !j.completed_at ? "In progress" : owing > 0 ? "Awaiting payment" : "Complete";
          const StageIcon = !j.completed_at ? Hammer : owing > 0 ? Wallet : CheckCircle2;
          const stageColor = !j.completed_at ? "#3b82f6" : owing > 0 ? "var(--amber-deep)" : "#16a34a";

          return (
            <div key={j.id} className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-[var(--ink)] text-[15px]">{j.client_name || "Unnamed client"}</p>
                  <p className="text-[13px] text-[var(--ink-faint)]">{j.site_address}</p>
                  {j.invoice_number && <p className="text-[11px] text-[var(--ink-faint)] font-mono mt-1">{j.invoice_number}</p>}
                </div>
                <div className="text-right">
                  <p className="font-display text-lg text-[var(--ink)]">${(j.total_cost ?? 0).toLocaleString()}</p>
                  {owing > 0 && j.amount_paid! > 0 && <p className="text-[12px] text-[var(--ink-faint)]">paid ${j.amount_paid?.toLocaleString()}</p>}
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-2">
                <StageIcon size={14} style={{ color: stageColor }} />
                <span className="text-[12.5px] font-semibold" style={{ color: stageColor }}>
                  {stage}
                  {stage === "Awaiting payment" && ` — $${owing.toLocaleString()} owing`}
                </span>
              </div>

              <div className="flex gap-2 mt-3 flex-wrap items-center">
                {!j.completed_at && (
                  <button
                    onClick={() => callUpdate({ quoteId: j.id, completeJob: true })}
                    disabled={busyId === j.id}
                    className="text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5 disabled:opacity-40"
                  >
                    Mark job complete
                  </button>
                )}
                {owing > 0 && (
                  <>
                    {paymentInputId === j.id ? (
                      <span className="flex items-center gap-1.5">
                        <input
                          type="number"
                          autoFocus
                          value={paymentValue}
                          onChange={(e) => setPaymentValue(e.target.value)}
                          placeholder={`up to ${owing}`}
                          className="app-field text-[13px] py-1.5 w-28"
                        />
                        <button
                          onClick={() => recordPayment(j.id, owing)}
                          disabled={busyId === j.id}
                          className="text-[13px] font-semibold bg-[var(--navy)] text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
                        >
                          Save
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setPaymentInputId(j.id);
                          setPaymentValue(String(owing));
                        }}
                        className="text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5"
                      >
                        Record payment
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
