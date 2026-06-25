"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, AlertTriangle } from "lucide-react";

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
  follow_up_at: string | null;
  quote_expires_at: string | null;
  sent_at: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[var(--app-bg)] text-[var(--ink-soft)]",
  sent: "bg-blue-50 text-blue-700",
  accepted: "bg-amber-50 text-amber-800",
  declined: "bg-red-50 text-red-700",
  paid: "bg-green-50 text-green-700",
};

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

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
  const [filter, setFilter] = useState<string>("all");

  const acceptedNotExported = quotes.filter((q) => q.status === "accepted" && !q.xero_exported_at);

  // Alerts: overdue follow-ups and expired quotes
  const overdueFollowUps = quotes.filter((q) => q.status === "sent" && q.follow_up_at && daysUntil(q.follow_up_at)! < 0);
  const expiredQuotes = quotes.filter((q) => q.status === "sent" && q.quote_expires_at && daysUntil(q.quote_expires_at)! < 0);
  const noFollowUpSent = quotes.filter((q) => q.status === "sent" && !q.follow_up_at && daysAgo(q.sent_at)! >= 3);

  const filtered = filter === "all" ? quotes : quotes.filter((q) => q.status === filter);

  async function callUpdate(body: Record<string, unknown>) {
    setBusyId(body.quoteId as string);
    const res = await fetch("/api/quotes/update-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
    if (res.status === 404) { setExportMessage("No accepted quotes ready to export."); setExporting(false); return; }
    if (!res.ok) { const body = await res.json().catch(() => ({})); setExportMessage(body.error ?? "Export failed"); setExporting(false); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xero-import-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportMessage(`Exported ${acceptedNotExported.length} invoice(s). Import in Xero under Business > Invoices > Import.`);
    setExporting(false);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-16">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-[var(--ink)]">Quotes</h1>
        <Link href="/electrician" className="bg-[var(--amber)] text-[var(--navy)] text-sm font-bold px-4 py-2 rounded-lg">New quote</Link>
      </div>

      {/* Alerts */}
      {(overdueFollowUps.length > 0 || expiredQuotes.length > 0 || noFollowUpSent.length > 0) && (
        <div className="space-y-2 mb-4">
          {overdueFollowUps.map((q) => (
            <Link key={q.id} href={`/electrician/quotes/${q.id}`} className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-[13px] font-semibold">
              <Bell size={14} /> Follow-up overdue: {q.client_name} — {Math.abs(daysUntil(q.follow_up_at)!)} day{Math.abs(daysUntil(q.follow_up_at)!) !== 1 ? "s" : ""} late
            </Link>
          ))}
          {expiredQuotes.map((q) => (
            <Link key={q.id} href={`/electrician/quotes/${q.id}`} className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-[13px] font-semibold">
              <AlertTriangle size={14} /> Quote expired: {q.client_name}
            </Link>
          ))}
          {noFollowUpSent.map((q) => (
            <Link key={q.id} href={`/electrician/quotes/${q.id}`} className="flex items-center gap-2 bg-amber-50 text-amber-800 rounded-lg px-3 py-2.5 text-[13px] font-semibold">
              <Bell size={14} /> No follow-up set: {q.client_name} — sent {daysAgo(q.sent_at)} days ago
            </Link>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {["all","draft","sent","accepted","paid","declined"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold border-2 capitalize ${filter === s ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"}`}>
            {s === "all" ? `All (${quotes.length})` : `${s} (${quotes.filter((q) => q.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Xero export */}
      {acceptedNotExported.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 mb-4">
          <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Xero</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-2">{acceptedNotExported.length} accepted quote(s) ready to export.</p>
          <button onClick={exportToXero} disabled={exporting} className="bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40">
            {exporting ? "Exporting..." : "Export to Xero CSV"}
          </button>
          {exportMessage && <p className="text-[13px] text-[var(--ink-soft)] mt-2">{exportMessage}</p>}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-8 text-center">
            <p className="text-[var(--ink-faint)] text-sm">No quotes matching this filter.</p>
          </div>
        )}
        {filtered.map((q) => {
          const owing = (q.total_cost ?? 0) - (q.amount_paid ?? 0);
          const followUpDays = daysUntil(q.follow_up_at);
          const expiryDays = daysUntil(q.quote_expires_at);
          return (
            <div key={q.id} className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <Link href={`/electrician/quotes/${q.id}`} className="font-semibold text-[var(--ink)] text-[15px] hover:underline">
                    {q.client_name || "Unnamed client"}
                  </Link>
                  <p className="text-[13px] text-[var(--ink-faint)]">{q.site_address}</p>
                  {q.invoice_number && <p className="text-[11px] text-[var(--ink-faint)] font-mono mt-0.5">{q.invoice_number}</p>}
                  <p className="text-[11.5px] text-[var(--ink-faint)] mt-0.5">{new Date(q.created_at).toLocaleDateString("en-AU")}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg text-[var(--ink)]">${(q.total_cost ?? 0).toLocaleString()}</p>
                  {(q.amount_paid ?? 0) > 0 && q.status !== "paid" && <p className="text-[12px] text-[var(--ink-faint)]">paid ${q.amount_paid?.toLocaleString()}</p>}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[q.status] ?? ""}`}>{statusLabel(q)}</span>
                </div>
              </div>

              {/* Follow-up / expiry nudges inline */}
              {q.status === "sent" && followUpDays !== null && followUpDays <= 0 && (
                <p className="text-[12px] text-red-600 font-semibold mt-1.5 flex items-center gap-1"><Bell size={11} /> Follow-up overdue</p>
              )}
              {q.status === "sent" && expiryDays !== null && expiryDays <= 0 && (
                <p className="text-[12px] text-red-600 font-semibold mt-1 flex items-center gap-1"><AlertTriangle size={11} /> Quote expired</p>
              )}

              <div className="flex gap-2 mt-3 flex-wrap items-center">
                <Link href={`/electrician/quotes/${q.id}`} className="text-[13px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-3 py-1.5">
                  View →
                </Link>
                {q.status === "sent" && (
                  <button onClick={() => callUpdate({ quoteId: q.id, status: "accepted" })} disabled={busyId === q.id} className="text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5 disabled:opacity-40">Mark accepted</button>
                )}
                {q.status === "accepted" && !q.completed_at && (
                  <button onClick={() => callUpdate({ quoteId: q.id, completeJob: true })} disabled={busyId === q.id} className="text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5 disabled:opacity-40">Mark complete</button>
                )}
                {q.status === "accepted" && owing > 0 && (
                  <>
                    {paymentInputId === q.id ? (
                      <span className="flex items-center gap-1.5">
                        <input type="number" autoFocus value={paymentValue} onChange={(e) => setPaymentValue(e.target.value)} placeholder={`up to ${owing}`} className="app-field text-[13px] py-1.5 w-28" />
                        <button onClick={() => recordPayment(q.id)} disabled={busyId === q.id} className="text-[13px] font-semibold bg-[var(--navy)] text-white rounded-lg px-3 py-1.5 disabled:opacity-40">Save</button>
                      </span>
                    ) : (
                      <button onClick={() => { setPaymentInputId(q.id); setPaymentValue(String(owing)); }} className="text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5">Record payment</button>
                    )}
                  </>
                )}
                {(q.status === "sent" || q.status === "draft") && (
                  <button onClick={() => callUpdate({ quoteId: q.id, status: "declined" })} disabled={busyId === q.id} className="text-[13px] font-semibold text-red-600 border-2 border-[var(--line)] rounded-lg px-3 py-1.5 disabled:opacity-40">Decline</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
