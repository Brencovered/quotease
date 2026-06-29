"use client";

import { useMemo, useState } from "react";
import { Search, Flame, Thermometer, Snowflake } from "lucide-react";

interface RequestRow {
  id: string;
  homeowner_id: string | null;
  trade: string;
  suburb: string;
  postcode: string | null;
  description: string;
  budget: string | null;
  timeline: string | null;
  num_quotes_wanted: number;
  lead_temperature: string;
  status: string;
  created_at: string;
  homeowner: { id: string; name: string; email: string; phone: string | null } | null;
}

const TEMP_ICON: Record<string, { Icon: typeof Flame; color: string }> = {
  hot:  { Icon: Flame,       color: "text-[var(--red)]" },
  warm: { Icon: Thermometer, color: "text-[var(--amber-deep)]" },
  cold: { Icon: Snowflake,   color: "text-[var(--blue)]" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminQuoteRequestsPanel({ rows }: { rows: RequestRow[] }) {
  const [query, setQuery] = useState("");
  const [tradeFilter, setTradeFilter] = useState("all");

  const trades = useMemo(() => Array.from(new Set(rows.map((r) => r.trade))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tradeFilter !== "all" && r.trade !== tradeFilter) return false;
      if (!q) return true;
      return (
        r.suburb.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.homeowner?.name ?? "").toLowerCase().includes(q) ||
        (r.homeowner?.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, tradeFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-[var(--ink)]">Quote requests</h1>
          <p className="text-[13px] text-[var(--ink-faint)]">{rows.length} request{rows.length !== 1 ? "s" : ""} from households</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ink-faint)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search suburb, name, description..."
              className="app-field pl-8 py-1.5 text-[13px] w-64"
            />
          </div>
          <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)} className="app-field py-1.5 text-[13px] w-auto capitalize">
            <option value="all">All trades</option>
            {trades.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-[13.5px] text-[var(--ink-faint)]">No quote requests match that search.</p>
        ) : (
          <ul className="divide-y divide-[var(--line-subtle)]">
            {filtered.map((r) => {
              const temp = TEMP_ICON[r.lead_temperature] ?? TEMP_ICON.warm;
              return (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <temp.Icon className={`w-4 h-4 ${temp.color}`} />
                    <p className="font-semibold text-[14px] text-[var(--ink)] capitalize">{r.trade}</p>
                    <span className="text-[12.5px] text-[var(--ink-faint)]">· {r.suburb}{r.postcode ? ` ${r.postcode}` : ""}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wide bg-gray-100 text-gray-600 capitalize">{r.status}</span>
                  </div>
                  <p className="text-[13.5px] text-[var(--ink-soft)] mb-1.5">{r.description}</p>
                  <div className="flex items-center gap-4 text-[12px] text-[var(--ink-faint)] flex-wrap">
                    <span>{r.homeowner?.name ?? "Unknown homeowner"}{r.homeowner?.email ? ` · ${r.homeowner.email}` : ""}</span>
                    {r.budget && <span>Budget: {r.budget}</span>}
                    {r.timeline && <span>Timeline: {r.timeline}</span>}
                    <span>Wants {r.num_quotes_wanted} quote{r.num_quotes_wanted !== 1 ? "s" : ""}</span>
                    <span>{fmtDate(r.created_at)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
