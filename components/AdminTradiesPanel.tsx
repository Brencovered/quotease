"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { TradieRow } from "@/lib/adminData";

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const SUB_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  trialing: { bg: "bg-amber-50",  text: "text-amber-700",  label: "Trial" },
  active:   { bg: "bg-green-50",  text: "text-green-700",  label: "Active" },
  past_due: { bg: "bg-red-50",    text: "text-red-700",    label: "Past due" },
  canceled: { bg: "bg-gray-100",  text: "text-gray-600",   label: "Canceled" },
  none:     { bg: "bg-gray-100",  text: "text-gray-500",   label: "No plan" },
};

export default function AdminTradiesPanel({ rows }: { rows: TradieRow[] }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "engagement" | "name">("recent");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((r) =>
        (r.business_name ?? "").toLowerCase().includes(q) ||
        (r.contact_email ?? "").toLowerCase().includes(q) ||
        r.trades.some((t) => t.toLowerCase().includes(q))
      );
    }
    const sorted = [...list];
    if (sortBy === "recent") sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sortBy === "engagement") sorted.sort((a, b) => b.engagement.pct - a.engagement.pct);
    if (sortBy === "name") sorted.sort((a, b) => (a.business_name ?? "").localeCompare(b.business_name ?? ""));
    return sorted;
  }, [rows, query, sortBy]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-[var(--ink)]">Tradie accounts</h1>
          <p className="text-[13px] text-[var(--ink-faint)]">{rows.length} account{rows.length !== 1 ? "s" : ""} total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ink-faint)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search business, email, trade..."
              className="app-field pl-8 py-1.5 text-[13px] w-64"
            />
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="app-field py-1.5 text-[13px] w-auto">
            <option value="recent">Newest first</option>
            <option value="engagement">Most engaged</option>
            <option value="name">Business name</option>
          </select>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-[13.5px] text-[var(--ink-faint)]">No accounts match that search.</p>
        ) : (
          <ul className="divide-y divide-[var(--line-subtle)]">
            {filtered.map((r) => {
              const sub = SUB_STYLE[r.subscription_status] ?? SUB_STYLE.none;
              return (
                <li key={r.id}>
                  <Link href={`/admin/tradies/${r.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--app-bg)] transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[14px] text-[var(--ink)] truncate">{r.business_name || "Unnamed business"}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wide ${sub.bg} ${sub.text}`}>{sub.label}</span>
                        {r.deleted_at && (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wide bg-red-50 text-red-700">Deleted</span>
                        )}
                      </div>
                      <p className="text-[12.5px] text-[var(--ink-faint)] truncate">
                        {r.contact_email || "No email"} {r.trades.length > 0 ? `· ${r.trades.join(", ")}` : ""}
                      </p>
                    </div>

                    <div className="w-44 hidden sm:block">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-[var(--ink-soft)]">{r.engagement.furthestLabel}</span>
                        <span className="text-[11px] font-bold text-[var(--ink)]">{r.engagement.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--app-bg)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--amber)]"
                          style={{ width: `${r.engagement.pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="hidden md:block text-right w-28">
                      <p className="text-[13px] font-semibold text-[var(--ink)]">{r.quotesCreated} quote{r.quotesCreated !== 1 ? "s" : ""}</p>
                      <p className="text-[11.5px] text-[var(--ink-faint)]">Active {timeAgo(r.last_sign_in_at)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
