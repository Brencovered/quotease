"use client";

import { DollarSign, CheckCircle2, TrendingUp, TrendingDown, Briefcase, Users } from "lucide-react";
import type { ReportStats } from "@/lib/reportStats";

export default function ReportsPanel({ stats, isAdmin }: { stats: ReportStats; isAdmin: boolean }) {
  const revenueDelta = stats.revenueThisMonth - stats.revenueLastMonth;
  const revenueUp = revenueDelta >= 0;

  return (
    <div className="page-wrap">
      <h1 className="font-display text-[28px] text-[var(--ink)] mb-1">Reports</h1>
      <p className="text-[13px] text-[var(--ink-faint)] mb-5">What actually happened, not just what&apos;s in the pipeline.</p>

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-[var(--amber-deep)]" />
            <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Revenue this month</span>
          </div>
          <p className="font-display text-[24px] text-[var(--ink)]">${stats.revenueThisMonth.toLocaleString()}</p>
          {stats.revenueLastMonth > 0 && (
            <p className={`text-[11px] font-semibold flex items-center gap-1 mt-1 ${revenueUp ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
              {revenueUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              ${Math.abs(revenueDelta).toLocaleString()} vs last month
            </p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-[var(--green)]" />
            <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Jobs completed</span>
          </div>
          <p className="font-display text-[24px] text-[var(--ink)]">{stats.jobsCompletedThisMonth}</p>
          <p className="text-[11px] text-[var(--ink-faint)] mt-1">{stats.jobsCompletedAllTime} all time</p>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-purple-500" />
            <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Avg job value</span>
          </div>
          <p className="font-display text-[24px] text-[var(--ink)]">
            {stats.avgJobValue !== null ? `$${stats.avgJobValue.toLocaleString()}` : "-"}
          </p>
          <p className="text-[11px] text-[var(--ink-faint)] mt-1">Across completed jobs</p>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase size={14} className="text-[var(--blue)]" />
            <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Active jobs</span>
          </div>
          <p className="font-display text-[24px] text-[var(--ink)]">{stats.totalActiveJobs}</p>
          <p className="text-[11px] text-[var(--ink-faint)] mt-1">Not yet complete</p>
        </div>
      </div>

      {/* Team productivity */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-[var(--navy)]" />
          <h2 className="font-bold text-[17px] text-[var(--ink)]">Team productivity</h2>
        </div>

        {!isAdmin ? (
          <p className="text-[13px] text-[var(--ink-faint)]">Only business owners and admins can see team-wide productivity.</p>
        ) : stats.teamProductivity.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-faint)]">No completed jobs or logged hours yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide border-b border-[var(--line)]">
                  <th className="pb-2 pr-4">Team member</th>
                  <th className="pb-2 pr-4">Jobs completed</th>
                  <th className="pb-2 pr-4">Hours logged</th>
                  <th className="pb-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats.teamProductivity.map((row) => (
                  <tr key={row.memberId ?? "unassigned"} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-2 pr-4 font-semibold text-[var(--ink)]">{row.name}</td>
                    <td className="py-2 pr-4 text-[var(--ink-soft)]">{row.jobsCompleted}</td>
                    <td className="py-2 pr-4 text-[var(--ink-soft)]">{row.hoursLogged.toLocaleString()}</td>
                    <td className="py-2 font-semibold text-[var(--ink)]">${row.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
