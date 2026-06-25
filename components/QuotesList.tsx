"use client";

import { useState } from "react";
import Link from "next/link";

type PaymentTerm = { label: string; percent: number; trigger: string; days: number };

type Quote = {
  id: string;
  client_name: string | null;
  client_email: string | null;
  site_address: string | null;
  status: string;
  total_cost: number | null;
  amount_paid: number | null;
  payment_terms: PaymentTerm[] | null;
  invoice_number: string | null;
  xero_exported_at: string | null;
  completed_at: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[var(--app-bg)] text-[var(--ink-soft)]",
  sent: "bg-blue-50 text-blue-700",
  accepted: "bg-amber-50 text-amber-800",
  declined: "bg-red-50 text-red-700",
  paid: "bg-green-50 text-green-700",
};

function statusLabel(q: Quote): string {
  if (q.status === "accepted") {
    const owing = (q.total_cost ?? 0) - (q.amount_paid ?? 0);
    return owing > 0 ? `outstanding $${owing.toLocaleString()}` : "accepted";
  }
  return q.status;
}

export default function QuotesList({ quotes: initialQuotes }: { quotes: Quote[] }) {
  const [quotes] = useState(initialQuotes);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [paymentInputId, setPaymentInputId] = useState<string | null>(null);
  const [paymentValue, setPaymentValue] = useState("");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const acceptedNotExported = quotes.filter((q) => q.status === "accepted" && !q.xero_exported_at);

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

  async function recordPayment(quoteId: string) {
    const amount = Number(paymentValue);
    if (!amount || amount <= 0) return;
    await callUpdate({ quoteId, paymentAmount: amount });
    setPaymentInputId(null);
    setPaymentValue("");
  }

  async function exportToXero() {
    setExporting(true);
    setExportMessage(null);
    const res = await fetch("/api/quotes/export-xero-csv");
    if (res.status === 404) {
      setExportMessage("No accepted quotes ready to export.");
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
    setExportMessage(
      `Exported ${acceptedNotExported.length} invoice(s). Import this file in Xero under Business > Invoices > Import.`
    );
    setExporting(false);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-16">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-[var(--ink)]">Quotes</h1>
        <Link href="/electrician" className="bg-[var(--amber)] text-[var(--navy)] text-sm font-bold px-4 py-2 rounded-lg">
          New quote
        </Link>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5 mb-5">
        <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Xero</p>
        <p className="font-semibold text-[var(--ink)] mb-1">Track in Xero</p>
        <p className="text-[13px] text-[var(--ink-faint)] mb-3">
          {acceptedNotExported.length > 0
            ? `${acceptedNotExported.length} accepted quote(s) ready to export.`
            : "No accepted quotes waiting on export right now."}{" "}
          Downloads a CSV you import directly in Xero — no account connection needed.
        </p>
        <button
          onClick={exportToXero}
          disabled={exporting || acceptedNotExported.length === 0}
          className="bg-[var(--navy)] text-white rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
        >
          {exporting ? "Exporting..." : "Export accepted quotes to Xero CSV"}
        </button>
        {exportMessage && <p className="text-[13px] text-[var(--ink-soft)] mt-2">{exportMessage}</p>}
      </div>

      <div className="flex flex-col gap-3">
        {quotes.length === 0 && (
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-8 text-center">
            <p className="text-[var(--ink-faint)] text-sm">No quotes yet — build your first one.</p>
          </div>
        )}
        {quotes.map((q) => {
          const owing = (q.total_cost ?? 0) - (q.amount_paid ?? 0);
          return (
            <div key={q.id} className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-[var(--ink)] text-[15px]">{q.client_name || "Unnamed client"}</p>
                  <p className="text-[13px] text-[var(--ink-faint)]">{q.site_address}</p>
                  {q.invoice_number && <p className="text-[11px] text-[var(--ink-faint)] font-mono mt-1">{q.invoice_number}</p>}
                </div>
                <div className="text-right">
                  <p className="font-display text-lg text-[var(--ink)]">${(q.total_cost ?? 0).toLocaleString()}</p>
                  {(q.amount_paid ?? 0) > 0 && q.status !== "paid" && (
                    <p className="text-[12px] text-[var(--ink-faint)]">paid ${q.amount_paid?.toLocaleString()}</p>
                  )}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[q.status] ?? ""}`}>
                    {statusLabel(q)}
                  </span>
                </div>
              </div>

              {q.payment_terms && q.payment_terms.length > 0 && (
                <div className="text-[12px] text-[var(--ink-faint)] mt-2 space-y-0.5">
                  {q.payment_terms.map((t, i) => (
                    <p key={i}>
                      {t.label}: {t.percent}% ({t.trigger.replace("_", " ")}, +{t.days}d)
                    </p>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-3 flex-wrap items-center">
                {q.status === "sent" && (
                  <button
                    onClick={() => callUpdate({ quoteId: q.id, status: "accepted" })}
                    disabled={busyId === q.id}
                    className="text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5 disabled:opacity-40"
                  >
                    Mark accepted
                  </button>
                )}
                {q.status === "accepted" && !q.completed_at && (
                  <button
                    onClick={() => callUpdate({ quoteId: q.id, completeJob: true })}
                    disabled={busyId === q.id}
                    className="text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5 disabled:opacity-40"
                  >
                    Mark job complete
                  </button>
                )}
                {q.status === "accepted" && owing > 0 && (
                  <>
                    {paymentInputId === q.id ? (
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
                          onClick={() => recordPayment(q.id)}
                          disabled={busyId === q.id}
                          className="text-[13px] font-semibold bg-[var(--navy)] text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
                        >
                          Save
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setPaymentInputId(q.id);
                          setPaymentValue(String(owing));
                        }}
                        className="text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5"
                      >
                        Record payment
                      </button>
                    )}
                  </>
                )}
                {(q.status === "sent" || q.status === "draft") && (
                  <button
                    onClick={() => callUpdate({ quoteId: q.id, status: "declined" })}
                    disabled={busyId === q.id}
                    className="text-[13px] font-semibold text-red-600 border-2 border-[var(--line)] rounded-lg px-3 py-1.5 disabled:opacity-40"
                  >
                    Mark declined
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
