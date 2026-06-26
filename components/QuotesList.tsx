"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Bell, AlertTriangle, ChevronRight, Plus, FileText, Send, CheckCircle2, BadgeCheck, XCircle } from "lucide-react";
import WinCelebration from "./WinCelebration";

type PaymentTerm = { label: string; percent: number; trigger: string; days: number };
type Quote = {
  id: string; client_name: string | null; client_email: string | null;
  site_address: string | null; status: string; total_cost: number | null;
  amount_paid: number | null; payment_terms: PaymentTerm[] | null;
  invoice_number: string | null; xero_exported_at: string | null;
  completed_at: string | null; created_at: string;
  follow_up_at: string | null; quote_expires_at: string | null; sent_at: string | null;
};

const STATUS: Record<string, { label: string; bg: string; text: string; icon: typeof FileText }> = {
  draft:    { label: "Draft",    bg: "bg-[var(--app-bg)]",       text: "text-[var(--ink-faint)]",   icon: FileText },
  sent:     { label: "Sent",     bg: "bg-[var(--blue-bg)]",      text: "text-[var(--blue)]",        icon: Send },
  accepted: { label: "Accepted", bg: "bg-[var(--amber-light)]",  text: "text-[var(--amber-deep)]",  icon: CheckCircle2 },
  declined: { label: "Declined", bg: "bg-[var(--red-bg)]",       text: "text-[var(--red)]",         icon: XCircle },
  paid:     { label: "Paid",     bg: "bg-[var(--green-bg)]",     text: "text-[var(--green)]",       icon: BadgeCheck },
};

const FILTERS = ["all","draft","sent","accepted","paid","declined"];

function daysUntil(d: string | null) { if (!d) return null; return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }
function daysAgo(d: string | null)   { if (!d) return null; return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }

export default function QuotesList({ quotes: initial }: { quotes: Quote[] }) {
  const [quotes]  = useState(initial);
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("status");
  const [filter,  setFilter]  = useState(initialFilter && FILTERS.includes(initialFilter) ? initialFilter : "all");
  const [busyId,  setBusyId]  = useState<string | null>(null);
  const [payId,   setPayId]   = useState<string | null>(null);
  const [payVal,  setPayVal]  = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<number | null>(null);

  async function markAccepted(q: Quote) {
    setCelebrating(q.total_cost ?? 0);
    setTimeout(() => callUpdate({ quoteId: q.id, status: "accepted" }), 1100);
  }

  const filtered = filter === "all" ? quotes : quotes.filter((q) => q.status === filter);
  const overdueFollowUps = quotes.filter((q) => q.status === "sent" && q.follow_up_at && daysUntil(q.follow_up_at)! < 0);
  const expiredQuotes    = quotes.filter((q) => q.status === "sent" && q.quote_expires_at && daysUntil(q.quote_expires_at)! < 0);
  const noFollowUp       = quotes.filter((q) => q.status === "sent" && !q.follow_up_at && daysAgo(q.sent_at)! >= 3);
  const notExported      = quotes.filter((q) => q.status === "accepted" && !q.xero_exported_at);

  async function callUpdate(body: Record<string, unknown>) {
    setBusyId(body.quoteId as string);
    const res = await fetch("/api/quotes/update-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) window.location.reload();
    setBusyId(null);
  }

  async function exportXero() {
    setExporting(true); setExportMsg(null);
    const res = await fetch("/api/quotes/export-xero-csv");
    if (res.status === 404) { setExportMsg("Nothing to export."); setExporting(false); return; }
    if (!res.ok) { const b = await res.json().catch(() => ({})); setExportMsg(b.error ?? "Export failed"); setExporting(false); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = `xero-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setExportMsg(`Exported ${notExported.length} invoice(s).`); setExporting(false);
  }

  return (
    <div className="page-wrap">
      {celebrating !== null && <WinCelebration amount={celebrating} />}
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-[28px] text-[var(--ink)]">Quotes</h1>
        <Link href="/electrician" className="inline-flex items-center gap-1.5 bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[13px] px-4 py-2.5 rounded-xl">
          <Plus size={15} /> New
        </Link>
      </div>

      {/* Alerts */}
      {(overdueFollowUps.length > 0 || expiredQuotes.length > 0 || noFollowUp.length > 0) && (
        <div className="space-y-2 mb-4">
          {overdueFollowUps.map((q) => (
            <Link key={q.id} href={`/electrician/quotes/${q.id}`} className="flex items-center gap-3 bg-[var(--red-bg)] border border-red-200 rounded-xl px-4 py-3">
              <Bell size={14} className="text-[var(--red)] shrink-0" />
              <span className="text-[13px] font-semibold text-[var(--red)] flex-1">Follow-up overdue: {q.client_name}</span>
              <ChevronRight size={14} className="text-red-300" />
            </Link>
          ))}
          {expiredQuotes.map((q) => (
            <Link key={q.id} href={`/electrician/quotes/${q.id}`} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              <span className="text-[13px] font-semibold text-amber-800 flex-1">Quote expired: {q.client_name}</span>
              <ChevronRight size={14} className="text-amber-300" />
            </Link>
          ))}
          {noFollowUp.map((q) => (
            <Link key={q.id} href={`/electrician/quotes/${q.id}`} className="flex items-center gap-3 bg-[var(--blue-bg)] border border-blue-200 rounded-xl px-4 py-3">
              <Bell size={14} className="text-[var(--blue)] shrink-0" />
              <span className="text-[13px] font-semibold text-[var(--blue)] flex-1">No follow-up set: {q.client_name}</span>
              <ChevronRight size={14} className="text-blue-300" />
            </Link>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto hide-scrollbar pb-1">
        {FILTERS.map((f) => {
          const count = f === "all" ? quotes.length : quotes.filter((q) => q.status === f).length;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold capitalize whitespace-nowrap border-2 transition-colors ${
                filter === f ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-faint)] bg-[var(--surface)]"
              }`}>
              {f === "all" ? "All" : f} {count > 0 && <span className="opacity-60 ml-0.5">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Xero */}
      {notExported.length > 0 && (
        <div className="card mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold text-[var(--ink)]">{notExported.length} ready for Xero</p>
            {exportMsg && <p className="text-[12px] text-[var(--ink-faint)] mt-0.5">{exportMsg}</p>}
          </div>
          <button onClick={exportXero} disabled={exporting} className="btn-secondary text-[13px] py-2 whitespace-nowrap">
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card text-center py-12">
            {filter === "all" ? (
              <>
                <p className="text-[32px] mb-3">📋</p>
                <p className="font-semibold text-[var(--ink)] mb-1">No quotes yet</p>
                <p className="text-[13.5px] text-[var(--ink-faint)] mb-5 max-w-[220px] mx-auto">
                  Build your first quote and send it before the next tradie does.
                </p>
                <Link href="/electrician" className="btn-primary inline-flex w-auto px-6 text-[14px]">
                  Build a quote →
                </Link>
              </>
            ) : (
              <p className="text-[var(--ink-faint)] text-[14px]">No {filter} quotes.</p>
            )}
          </div>
        )}
        {filtered.map((q) => {
          const s    = STATUS[q.status] ?? STATUS.draft;
          const Icon = s.icon;
          const owing = (q.total_cost ?? 0) - (q.amount_paid ?? 0);
          const expDays = daysUntil(q.quote_expires_at);
          const followDays = daysUntil(q.follow_up_at);
          return (
            <div key={q.id} className="card">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <Link
                    href={q.status === "accepted" || q.status === "paid" ? `/electrician/jobs/${q.id}` : `/electrician/quotes/${q.id}`}
                    className="font-bold text-[15px] text-[var(--ink)] hover:underline block truncate"
                  >
                    {q.client_name || "Unnamed client"}
                  </Link>
                  {q.site_address && <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5 truncate">{q.site_address}</p>}
                  <p className="text-[11.5px] text-[var(--ink-faint)] mt-1">{new Date(q.created_at).toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"2-digit" })}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-[20px] text-[var(--ink)] leading-tight tabular">${(q.total_cost ?? 0).toLocaleString()}</p>
                  <span className={`pill mt-1 ${s.bg} ${s.text}`}><Icon size={10} />{s.label}</span>
                </div>
              </div>

              {/* Nudges */}
              {q.status === "sent" && followDays !== null && followDays <= 0 && (
                <p className="text-[11.5px] text-[var(--red)] font-semibold mt-2 flex items-center gap-1"><Bell size={11} /> Follow-up overdue</p>
              )}
              {q.status === "sent" && expDays !== null && expDays <= 0 && (
                <p className="text-[11.5px] text-amber-600 font-semibold mt-2 flex items-center gap-1"><AlertTriangle size={11} /> Quote expired</p>
              )}
              {q.status === "accepted" && owing > 0 && (
                <p className="text-[12px] text-[var(--red)] font-semibold mt-2">${owing.toLocaleString()} outstanding</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-3 flex-wrap items-center">
                <Link
                  href={q.status === "accepted" || q.status === "paid" ? `/electrician/jobs/${q.id}` : `/electrician/quotes/${q.id}`}
                  className="btn-secondary text-[12.5px] py-1.5 px-3"
                >
                  Open →
                </Link>
                {q.status === "sent" && (
                  <button onClick={() => markAccepted(q)} disabled={busyId === q.id} className="btn-secondary text-[12.5px] py-1.5 px-3">
                    Mark accepted
                  </button>
                )}
                {q.status === "accepted" && owing > 0 && (
                  payId === q.id ? (
                    <span className="flex items-center gap-1.5">
                      <input type="number" autoFocus value={payVal} onChange={(e) => setPayVal(e.target.value)}
                        placeholder={`max $${owing}`} className="app-field text-[13px] py-1.5 w-28" />
                      <button onClick={async () => { await callUpdate({ quoteId: q.id, paymentAmount: Math.min(Number(payVal), owing) }); setPayId(null); setPayVal(""); }}
                        disabled={busyId === q.id} className="btn-secondary text-[12.5px] py-1.5 px-3">Save</button>
                    </span>
                  ) : (
                    <button onClick={() => { setPayId(q.id); setPayVal(String(owing)); }} className="btn-secondary text-[12.5px] py-1.5 px-3">
                      Record payment
                    </button>
                  )
                )}
                {(q.status === "sent" || q.status === "draft") && (
                  <button onClick={() => callUpdate({ quoteId: q.id, status: "declined" })} disabled={busyId === q.id}
                    className="text-[12px] font-semibold text-[var(--red)] ml-auto">
                    Decline
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
