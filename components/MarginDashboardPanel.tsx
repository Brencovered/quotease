"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp, ArrowUpDown } from "lucide-react";

type Row = {
  id: string; client_name: string | null; trade: string | null;
  total_cost: number; quotedHours: number; actualHours: number; actualMaterials: number; unexpectedCosts: number;
};

export default function MarginDashboardPanel({ rows, hourlyRate }: { rows: Row[]; hourlyRate: number }) {
  const [sortAsc, setSortAsc] = useState(true);

  const withMargin = rows
    .filter((r) => r.actualHours > 0 || r.actualMaterials > 0 || r.unexpectedCosts > 0)
    .map((r) => {
      const actualCost = r.actualHours * hourlyRate + r.actualMaterials + r.unexpectedCosts;
      const margin = r.total_cost - actualCost;
      const marginPct = r.total_cost > 0 ? Math.round((margin / r.total_cost) * 100) : 0;
      return { ...r, actualCost, margin, marginPct };
    })
    .sort((a, b) => sortAsc ? a.marginPct - b.marginPct : b.marginPct - a.marginPct);

  const notLogged = rows.filter((r) => r.actualHours === 0 && r.actualMaterials === 0 && r.unexpectedCosts === 0);
  const avgMargin = withMargin.length > 0 ? Math.round(withMargin.reduce((s, r) => s + r.marginPct, 0) / withMargin.length) : null;

  return (
    <main className="page-wrap">
      <h1 className="font-display text-[28px] text-[var(--ink)] mb-1">Margins</h1>
      <p className="text-[14px] text-[var(--ink-faint)] mb-5">
        Quoted vs actual, every job that has costs logged - worst margin first, so problems surface before they pile up.
      </p>

      {withMargin.length === 0 ? (
        <div className="card text-center py-12">
          <p className="font-semibold text-[var(--ink)] mb-1">Nothing to show yet</p>
          <p className="text-[13px] text-[var(--ink-faint)]">
            Log actual hours and materials on a job&apos;s detail page (Job Costing section) and it&apos;ll show up here.
          </p>
        </div>
      ) : (
        <>
          {avgMargin !== null && (
            <div className="bg-[var(--navy)] rounded-2xl p-4 mb-4">
              <p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide mb-1">Average margin</p>
              <p className={`font-display text-[26px] ${avgMargin >= 0 ? "text-white" : "text-[var(--red)]"}`}>{avgMargin}%</p>
            </div>
          )}

          <button onClick={() => setSortAsc((v) => !v)} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ink-faint)] mb-2">
            <ArrowUpDown size={13} /> {sortAsc ? "Worst margin first" : "Best margin first"}
          </button>

          <div className="card p-0 overflow-hidden mb-4">
            {withMargin.map((r) => (
              <Link key={r.id} href={`/electrician/jobs/${r.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--app-bg)] transition-colors">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[var(--ink)] truncate">{r.client_name || "Unnamed client"}</p>
                  <p className="text-[12px] text-[var(--ink-faint)] capitalize">
                    {r.trade} - quoted ${r.total_cost.toLocaleString()}, actual ${Math.round(r.actualCost).toLocaleString()}
                    {r.unexpectedCosts > 0 && <span className="text-amber-700 font-semibold"> (incl. ${r.unexpectedCosts.toLocaleString()} unexpected)</span>}
                  </p>
                </div>
                <div className={`flex items-center gap-1.5 shrink-0 font-display text-[18px] ${r.marginPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                  {r.marginPct >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {r.marginPct}%
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {notLogged.length > 0 && (
        <p className="text-[12.5px] text-[var(--ink-faint)]">
          {notLogged.length} job{notLogged.length === 1 ? "" : "s"} without costs logged yet, not shown above.
        </p>
      )}
    </main>
  );
}
