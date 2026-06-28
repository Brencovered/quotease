"use client";

import { useState, useMemo } from "react";
import { Download, Filter, Check, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Quote = {
  id: string; client_name: string | null; client_email: string | null;
  site_address: string | null; trade: string | null; job_type: string | null;
  total_cost: number | null; labour_hours: number | null; materials_cost: number | null;
  markup_materials: number | null; amount_paid: number | null; status: string;
  invoice_number: string | null; xero_exported_at: string | null;
  sent_at: string | null; accepted_at: string | null; completed_at: string | null;
  paid_at: string | null; created_at: string; scheduled_date: string | null;
};
type Variation = { quote_id: string; description: string; total_cost: number; status: string };
type Actual   = { quote_id: string; actual_hours: number; actual_materials_cost: number };

const TRADES = ["electrician","plumber","carpenter","roofer","painter","tiler",
  "landscaper","arborist","concreter","fencer","aircon","surveyor","custom"];

const TRADE_LABEL: Record<string,string> = {
  electrician:"Electrician", plumber:"Plumber", carpenter:"Carpenter",
  roofer:"Roofer", painter:"Painter", tiler:"Tiler", landscaper:"Landscaper",
  arborist:"Arborist", concreter:"Concreter", fencer:"Fencer",
  aircon:"Air conditioning", surveyor:"Surveyor", custom:"Custom",
};

function fmt(date: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-AU", { day:"2-digit", month:"2-digit", year:"numeric" });
}

function invoiceNum(q: Quote, idx: number) {
  return q.invoice_number ?? `INV-${String(idx + 1).padStart(4, "0")}`;
}

export default function ExportPanel({
  quotes, variations, actuals, businessName, abn,
}: {
  quotes: Quote[];
  variations: Variation[];
  actuals: Actual[];
  businessName: string;
  abn: string;
}) {
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [statusFilter,setStatusFilter]= useState("all");
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [exporting,   setExporting]   = useState(false);
  const [exported,    setExported]    = useState(false);

  // Compute effective total per quote
  const effectiveTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const q of quotes) {
      const varTotal = variations
        .filter(v => v.quote_id === q.id)
        .reduce((s, v) => s + (v.total_cost ?? 0), 0);
      map[q.id] = (q.total_cost ?? 0) + varTotal + (q.markup_materials ?? 0);
    }
    return map;
  }, [quotes, variations]);

  // Filtered list
  const filtered = useMemo(() => {
    return quotes.filter(q => {
      if (tradeFilter !== "all" && q.trade !== tradeFilter) return false;
      if (statusFilter !== "all" && q.status !== statusFilter) return false;
      if (dateFrom) {
        const d = q.accepted_at ?? q.created_at;
        if (d < dateFrom) return false;
      }
      if (dateTo) {
        const d = q.accepted_at ?? q.created_at;
        if (d > dateTo + "T23:59:59") return false;
      }
      return true;
    });
  }, [quotes, tradeFilter, statusFilter, dateFrom, dateTo]);

  const allSelected = filtered.length > 0 && filtered.every(q => selected.has(q.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(s => { const n = new Set(s); filtered.forEach(q => n.delete(q.id)); return n; });
    } else {
      setSelected(s => { const n = new Set(s); filtered.forEach(q => n.add(q.id)); return n; });
    }
  }

  function toggleOne(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function buildXeroCSV(rows: Quote[]): string {
    // Xero invoice import format
    const headers = [
      "*ContactName","EmailAddress","POAddressLine1","*InvoiceNumber",
      "*InvoiceDate","*DueDate","*Description","*Quantity","*UnitAmount",
      "*AccountCode","*TaxType","TrackingName1","TrackingOption1",
    ];
    const lines: string[] = [headers.join(",")];
    rows.forEach((q, i) => {
      const invNum   = invoiceNum(q, i);
      const date     = fmt(q.accepted_at ?? q.created_at);
      const dueDate  = fmt(q.paid_at ?? q.accepted_at ?? q.created_at);
      const total    = effectiveTotals[q.id] ?? 0;
      const desc     = `${TRADE_LABEL[q.trade ?? "custom"] ?? q.trade} - ${q.job_type ?? "Service"} at ${q.site_address ?? ""}`.replace(/,/g, " ");
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      lines.push([
        esc(q.client_name ?? ""),
        esc(q.client_email ?? ""),
        esc(q.site_address ?? ""),
        esc(invNum),
        date, date,
        esc(desc),
        "1",
        total.toFixed(2),
        "200", // Services income account
        "OUTPUT2", // GST on income
        esc(TRADE_LABEL[q.trade ?? "custom"] ?? ""),
        esc(q.trade ?? ""),
      ].join(","));
    });
    return lines.join("\n");
  }

  function buildMYOBCSV(rows: Quote[]): string {
    // MYOB AccountRight invoice import format
    const headers = [
      "Co./Last Name","First Name","Addr 1 - Line 1","Invoice #",
      "Date","Description","Total Incl. Tax","Tax Code","Status",
    ];
    const lines: string[] = [headers.join(",")];
    rows.forEach((q, i) => {
      const invNum = invoiceNum(q, i);
      const date   = fmt(q.accepted_at ?? q.created_at);
      const total  = effectiveTotals[q.id] ?? 0;
      const desc   = `${TRADE_LABEL[q.trade ?? "custom"] ?? q.trade} - ${q.job_type ?? "Service"}`.replace(/,/g, " ");
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      lines.push([
        esc(q.client_name ?? ""), "",
        esc(q.site_address ?? ""),
        esc(invNum),
        date,
        esc(desc),
        total.toFixed(2),
        "GST",
        q.status === "paid" ? "Closed" : "Open",
      ].join(","));
    });
    return lines.join("\n");
  }

  async function doExport(format: "xero" | "myob") {
    const rows = filtered.filter(q => selected.has(q.id));
    if (!rows.length) return;
    setExporting(true);

    const csv  = format === "xero" ? buildXeroCSV(rows) : buildMYOBCSV(rows);
    // BOM ensures Excel opens with correct encoding
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `swiftscope-${format}-export-${new Date().toISOString().slice(0, 10)}.csv`;
    // Must append to DOM for Firefox compatibility
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    // Mark as exported in DB
    const supabase = createClient();
    await supabase.from("quotes")
      .update({ xero_exported_at: new Date().toISOString() })
      .in("id", rows.map(r => r.id));

    setExporting(false);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  }

  const selectedRows = filtered.filter(q => selected.has(q.id));
  const selectedTotal = selectedRows.reduce((s, q) => s + (effectiveTotals[q.id] ?? 0), 0);
  const prevExported = filtered.filter(q => q.xero_exported_at).length;

  return (
    <div className="space-y-4">

      {/* How to use */}
      <div className="card bg-[var(--navy)]">
        <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--steel-3)] mb-3">How it works</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { n: "1", t: "Filter and select", b: "Pick the jobs you want to export. Filter by date, trade, or status." },
            { n: "2", t: "Download the CSV",  b: "Choose Xero or MYOB format. The file downloads instantly." },
            { n: "3", t: "Import in your app",b: "In Xero: Accounts > Sales > Import. In MYOB: Sales > Sales Register > Import." },
          ].map(s => (
            <div key={s.n} className="flex gap-3">
              <span className="font-display text-[1.4rem] text-[var(--amber)] leading-none shrink-0">{s.n}</span>
              <div>
                <p className="text-[13px] font-bold text-white mb-0.5">{s.t}</p>
                <p className="text-[12px] text-[var(--steel-3)] leading-snug">{s.b}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-[var(--ink-faint)]" />
          <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Filter</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="app-field text-[13px]" />
          </div>
          <div>
            <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="app-field text-[13px]" />
          </div>
          <div>
            <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Trade</label>
            <select value={tradeFilter} onChange={e => setTradeFilter(e.target.value)} className="app-field text-[13px]">
              <option value="all">All trades</option>
              {TRADES.map(t => <option key={t} value={t}>{TRADE_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="app-field text-[13px]">
              <option value="all">All statuses</option>
              <option value="accepted">Active jobs</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
        {(dateFrom || dateTo || tradeFilter !== "all" || statusFilter !== "all") && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); setTradeFilter("all"); setStatusFilter("all"); }}
            className="text-[12px] text-[var(--navy)] font-semibold mt-2 hover:opacity-70">
            Clear filters
          </button>
        )}
      </div>

      {/* Results table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)] bg-[var(--app-bg)]">
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={allSelected} onChange={toggleAll}
              className="w-4 h-4 rounded accent-[var(--navy)]" />
            <p className="text-[12px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">
              {filtered.length} job{filtered.length !== 1 ? "s" : ""}
              {prevExported > 0 && <span className="ml-2 text-[var(--green)]">· {prevExported} previously exported</span>}
            </p>
          </div>
          {selected.size > 0 && (
            <p className="text-[12.5px] font-semibold text-[var(--ink-soft)]">
              {selected.size} selected · <span className="text-[var(--amber)] font-bold">${selectedTotal.toLocaleString()}</span>
            </p>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13.5px] text-[var(--ink-faint)]">
            No accepted or paid jobs match your filters.
          </div>
        ) : (
          <div className="divide-y divide-[var(--line-subtle)]">
            {filtered.map((q, i) => {
              const inv   = invoiceNum(q, quotes.indexOf(q));
              const total = effectiveTotals[q.id] ?? 0;
              const act   = actuals.find(a => a.quote_id === q.id);
              return (
                <div key={q.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--app-bg)] transition-colors ${selected.has(q.id) ? "bg-[var(--amber-light)]" : ""}`}
                  onClick={() => toggleOne(q.id)}>
                  <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleOne(q.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 rounded accent-[var(--navy)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13.5px] font-semibold text-[var(--ink)] truncate">{q.client_name ?? "Unknown client"}</p>
                      <span className="text-[11px] font-bold text-[var(--ink-faint)] bg-[var(--app-bg)] border border-[var(--line)] px-1.5 py-0.5 rounded shrink-0">{inv}</span>
                      {q.xero_exported_at && (
                        <span className="text-[10.5px] font-bold text-[var(--green)] flex items-center gap-0.5 shrink-0">
                          <Check size={10} /> exported {fmt(q.xero_exported_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[var(--ink-faint)] truncate">
                      {TRADE_LABEL[q.trade ?? ""] ?? q.trade} · {q.job_type ?? "Service"} · {q.site_address ?? ""}
                    </p>
                    <p className="text-[11.5px] text-[var(--ink-faint)]">
                      Accepted {fmt(q.accepted_at)} · {q.status === "paid" ? `Paid ${fmt(q.paid_at)}` : "Outstanding"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display text-[17px] text-[var(--ink)]">${total.toLocaleString()}</p>
                    <p className="text-[11px] text-[var(--ink-faint)]">
                      {q.status === "paid" ? "paid" : `$${(q.amount_paid ?? 0).toLocaleString()} paid`}
                    </p>
                    {act && (
                      <p className="text-[11px] text-[var(--ink-faint)]">{act.actual_hours}h actual</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Export actions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-[var(--ink)]">
              {selected.size > 0 ? `${selected.size} job${selected.size !== 1 ? "s" : ""} selected` : "Select jobs above to export"}
            </p>
            {selected.size > 0 && (
              <p className="text-[13px] text-[var(--ink-faint)]">Total value: <span className="font-bold text-[var(--ink)]">${selectedTotal.toLocaleString()}</span></p>
            )}
          </div>
          {exported && (
            <span className="text-[13px] text-[var(--green)] font-semibold flex items-center gap-1.5">
              <Check size={14} /> Downloaded
            </span>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => doExport("xero")}
            disabled={selected.size === 0 || exporting}
            className="btn-primary justify-center disabled:opacity-40">
            <Download size={15} /> Download Xero CSV
          </button>
          <button
            onClick={() => doExport("myob")}
            disabled={selected.size === 0 || exporting}
            className="btn-secondary justify-center disabled:opacity-40">
            <Download size={15} /> Download MYOB CSV
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--line-subtle)] space-y-1.5">
          <p className="text-[12px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Import instructions</p>
          <p className="text-[12.5px] text-[var(--ink-faint)]">
            <span className="font-semibold text-[var(--ink-soft)]">Xero:</span> Accounts &gt; Sales Overview &gt; Import &gt; select the CSV file
          </p>
          <p className="text-[12.5px] text-[var(--ink-faint)]">
            <span className="font-semibold text-[var(--ink-soft)]">MYOB:</span> Sales &gt; Sales Register &gt; Import Sales &gt; select the CSV file
          </p>
          <p className="text-[12px] text-[var(--ink-faint)] mt-2">
            Jobs marked as previously exported won&apos;t be deselected automatically -- you can re-export them if needed.
            GST is calculated at 10% on the total.
          </p>
        </div>
      </div>

    </div>
  );
}
