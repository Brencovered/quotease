"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp, ArrowUpDown, Info, ClipboardList, ChevronRight } from "lucide-react";

type Row = {
  id: string; client_name: string | null; trade: string | null;
  total_cost: number; quotedHours: number; actualHours: number; actualMaterials: number; unexpectedCosts: number;
};

export default function MarginDashboardPanel({ rows, hourlyRate }: { rows: Row[]; hourlyRate: number }) {
  const [sortAsc, setSortAsc] = useState(true);
  const [showExplainer, setShowExplainer] = useState(false);

  const scored = rows
    .filter((r) => r.actualHours > 0 || r.actualMaterials > 0 || r.unexpectedCosts > 0)
    .map((r) => {
      const actualCost = r.actualHours * hourlyRate + r.actualMaterials + r.unexpectedCosts;
      const margin = r.total_cost - actualCost;
      const marginPct = r.total_cost > 0 ? Math.round((margin / r.total_cost) * 100) : 0;
      // For the visual bar: how big actual cost is relative to what was
      // quoted, capped so one wildly-over job doesn't blow out every bar.
      const barPct = r.total_cost > 0 ? Math.min(150, Math.round((actualCost / r.total_cost) * 100)) : 0;
      return { ...r, actualCost, margin, marginPct, barPct };
    })
    .sort((a, b) => (sortAsc ? a.marginPct - b.marginPct : b.marginPct - a.marginPct));

  const notLogged = rows.filter((r) => r.actualHours === 0 && r.actualMaterials === 0 && r.unexpectedCosts === 0);
  const avgMargin = scored.length > 0 ? Math.round(scored.reduce((s, r) => s + r.marginPct, 0) / scored.length) : null;

  return (
    <main className="page-wrap">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="font-display text-[28px] text-[var(--ink)]">Margins</h1>
        <button onClick={() => setShowExplainer((v) => !v)} className="text-[var(--ink-faint)] shrink-0 mt-2">
          <Info size={18} />
        </button>
      </div>
      <p className="text-[14px] text-[var(--ink-faint)] mb-3">
        What you actually made on each job, not just what you quoted.
      </p>

      {showExplainer && (
        <div className="bg-[var(--app-bg)] rounded-xl p-4 mb-5 text-[13px] text-[var(--ink-soft)] leading-relaxed">
          <p className="font-semibold text-[var(--ink)] mb-1">How this works</p>
          <p className="mb-2">
            A quote is your best guess before the job starts. <strong>Margin</strong> is the gap between that
            guess and what the job actually cost once it&apos;s done - your real hours, real material spend,
            and anything unexpected that came up.
          </p>
          <p>
            It only shows up here once you&apos;ve logged those actuals on a job&apos;s detail page (the
            <span className="font-semibold"> Job Costing</span> section). Nothing to set up - just fill it in
            after a job wraps and the numbers below update automatically.
          </p>
        </div>
      )}

      {/* Jobs ready to be logged - the actionable next step, not a footnote */}
      {notLogged.length > 0 && (
        <div className="card mb-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={15} className="text-[var(--amber-deep)]" />
            <p className="text-[13.5px] font-semibold text-[var(--ink)]">
              {notLogged.length} job{notLogged.length === 1 ? "" : "s"} ready to log
            </p>
          </div>
          <p className="text-[12.5px] text-[var(--ink-faint)] mb-3">
            Log actual hours and materials on these and they&apos;ll show up below.
          </p>
          <div className="space-y-1">
            {notLogged.slice(0, 5).map((j) => (
              <Link key={j.id} href={`/electrician/jobs/${j.id}`}
                className="flex items-center justify-between gap-2 py-2 px-2.5 -mx-2.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors">
                <span className="text-[13px] font-medium text-[var(--ink-soft)] truncate">{j.client_name || "Unnamed client"}</span>
                <span className="flex items-center gap-1 text-[12px] text-[var(--ink-faint)] shrink-0">
                  Log costs <ChevronRight size={13} />
                </span>
              </Link>
            ))}
          </div>
          {notLogged.length > 5 && (
            <p className="text-[12px] text-[var(--ink-faint)] mt-2">+{notLogged.length - 5} more</p>
          )}
        </div>
      )}

      {scored.length === 0 ? (
        <div className="card text-center py-12">
          <p className="font-semibold text-[var(--ink)] mb-1">No margins tracked yet</p>
          <p className="text-[13px] text-[var(--ink-faint)] max-w-xs mx-auto">
            {notLogged.length > 0
              ? "Pick a job above and log its actual costs to see your first margin here."
              : "Once you've got an accepted job, log its actual hours and materials and it'll show up here."}
          </p>
        </div>
      ) : (
        <>
          {avgMargin !== null && (
            <div className="bg-[var(--navy)] rounded-2xl p-4 mb-4">
              <p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide mb-1">Average margin, {scored.length} job{scored.length === 1 ? "" : "s"}</p>
              <p className={`font-display text-[26px] ${avgMargin >= 0 ? "text-white" : "text-[var(--red)]"}`}>{avgMargin}%</p>
            </div>
          )}

          <button onClick={() => setSortAsc((v) => !v)} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ink-faint)] mb-2">
            <ArrowUpDown size={13} /> {sortAsc ? "Worst margin first" : "Best margin first"}
          </button>

          <div className="card p-0 overflow-hidden mb-4">
            {scored.map((r) => (
              <Link key={r.id} href={`/electrician/jobs/${r.id}`}
                className="block px-4 py-3 border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--app-bg)] transition-colors">
                <div className="flex items-center justify-between gap-3 mb-1.5">
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
                </div>
                {/* Visual bar: quoted (full width, faint) vs actual cost overlaid */}
                <div className="h-1.5 rounded-full bg-[var(--app-bg)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r.barPct > 100 ? "bg-[var(--red)]" : "bg-[var(--green)]"}`}
                    style={{ width: `${Math.min(100, r.barPct)}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
