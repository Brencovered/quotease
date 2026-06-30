"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { DashboardStats, ProfitStats } from "@/lib/dashboardStats";
import {
  TrendingUp,
  DollarSign,
  FileText,
  CheckCircle2,
  ArrowUpRight,
  Zap,
  Briefcase,
  CalendarDays,
  Bell,
  AlertTriangle,
  Package,
  Clock,
} from "lucide-react";

interface Props {
  stats: DashboardStats;
  profit: ProfitStats;
}

export default function DashboardPanel({ stats, profit }: Props) {
  const supabase = createClient();
  const [packageCount, setPackageCount] = useState(0);

  useEffect(() => {
    async function fetchPackages() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase.from("packages").select("*", { count: "exact", head: true }).eq("profile_id", user.id).eq("status", "active");
      setPackageCount(count ?? 0);
    }
    fetchPackages();
  }, [supabase]);

  const followUpsDue = stats.overdueFollowUps ?? 0;
  const expiringSoon = stats.expiredQuotes ?? 0;

  return (
    <div className="page-wrap">
      <h1 className="font-display text-[28px] text-[var(--ink)] mb-5">Dashboard</h1>

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={14} className="text-[var(--blue)]" />
            <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Total quotes</span>
          </div>
          <p className="font-display text-[24px] text-[var(--ink)]">{stats.totalQuotes}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-[var(--green)]" />
            <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Won</span>
          </div>
          <p className="font-display text-[24px] text-[var(--ink)]">{stats.byStatus?.accepted ?? 0}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-[var(--amber-deep)]" />
            <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Quoted value</span>
          </div>
          <p className="font-display text-[24px] text-[var(--ink)]">${(stats.totalQuotedValue ?? 0).toLocaleString()}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-purple-500" />
            <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Win rate</span>
          </div>
          <p className="font-display text-[24px] text-[var(--ink)]">{stats.winRate ?? 0}%</p>
        </div>
      </div>

      {/* Alerts */}
      {(followUpsDue > 0 || expiringSoon > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {followUpsDue > 0 && (
            <Link href="/electrician/quotes?status=sent" className="flex items-center gap-3 bg-[var(--blue-bg)] border border-blue-200 rounded-xl px-4 py-3">
              <Bell size={16} className="text-[var(--blue)] shrink-0" />
              <div>
                <p className="text-[13px] font-bold text-[var(--blue)]">{followUpsDue} follow-up{followUpsDue !== 1 ? "s" : ""} due</p>
                <p className="text-[11px] text-blue-600">Check sent quotes</p>
              </div>
            </Link>
          )}
          {expiringSoon > 0 && (
            <Link href="/electrician/quotes?status=sent" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-[13px] font-bold text-amber-800">{expiringSoon} quote{expiringSoon !== 1 ? "s" : ""} expired</p>
                <p className="text-[11px] text-amber-600">Send reminders</p>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Status breakdown */}
      <div className="card mb-6">
        <h2 className="font-bold text-[16px] text-[var(--ink)] mb-4">Quote pipeline</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(["draft", "sent", "accepted", "declined", "paid"] as const).map((s) => (
            <div key={s} className="bg-[var(--app-bg)] rounded-xl p-3 text-center">
              <p className="text-[10px] font-bold text-[var(--ink-faint)] uppercase tracking-wide mb-1">{s}</p>
              <p className="font-display text-[20px] text-[var(--ink)]">{stats.byStatus?.[s] ?? 0}</p>
              <p className="text-[11px] text-[var(--ink-faint)]">${(stats.byStatusValue?.[s] ?? 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Profit section */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-[var(--green)]" />
          <h2 className="font-bold text-[17px] text-[var(--ink)]">Profit snapshot</h2>
        </div>
        {profit.jobsTracked === 0 ? (
          <p className="text-[13px] text-[var(--ink-faint)]">Log actual hours and material costs on completed jobs to see real profit data here.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide mb-1">Jobs tracked</p>
              <p className="font-display text-[18px] text-[var(--ink)]">{profit.jobsTracked}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide mb-1">Total profit</p>
              <p className={`font-display text-[18px] ${profit.totalProfit >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                ${Math.round(profit.totalProfit).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide mb-1">Avg margin</p>
              <p className={`font-display text-[18px] ${(profit.avgMarginPct ?? 0) >= 25 ? "text-[var(--green)]" : (profit.avgMarginPct ?? 0) >= 10 ? "text-[var(--amber-deep)]" : "text-[var(--red)]"}`}>
                {profit.avgMarginPct ?? 0}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Time saved */}
      {stats.avgQuoteTimeMinutes !== null && (
        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-[var(--blue)]" />
            <h2 className="font-bold text-[16px] text-[var(--ink)]">Time savings</h2>
          </div>
          <p className="text-[13px] text-[var(--ink-soft)]">
            Average quote time: <strong>{stats.avgQuoteTimeMinutes} min</strong> vs 45 min manually.
            {stats.timeSavedMinutes !== null && (
              <span className="text-[var(--green)] font-bold"> Saved {stats.timeSavedMinutes} min total.</span>
            )}
          </p>
        </div>
      )}

      {/* Monthly chart */}
      {stats.monthly && stats.monthly.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-bold text-[16px] text-[var(--ink)] mb-4">Last 6 months</h2>
          <div className="flex items-end gap-2 h-32">
            {stats.monthly.map((m) => {
              const maxVal = Math.max(...stats.monthly.map((x) => x.value), 1);
              const height = Math.max((m.value / maxVal) * 100, 4);
              return (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-[var(--amber)] rounded-t-lg" style={{ height: `${height}%` }} />
                  <p className="text-[10px] font-bold text-[var(--ink-faint)]">{m.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Link href="/electrician" className="inline-flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] rounded-xl px-4 py-3 font-semibold text-[14px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <span className="flex items-center gap-2"><Zap size={16} className="text-[var(--amber)]" /> New quote</span>
          <ArrowUpRight size={14} className="text-[var(--ink-faint)]" />
        </Link>
        <Link href="/electrician/jobs" className="inline-flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] rounded-xl px-4 py-3 font-semibold text-[14px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <span className="flex items-center gap-2"><Briefcase size={16} className="text-[var(--blue)]" /> Jobs ({stats.activeJobsCount ?? 0})</span>
          <ArrowUpRight size={14} className="text-[var(--ink-faint)]" />
        </Link>
        <Link href="/electrician/schedule" className="inline-flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] rounded-xl px-4 py-3 font-semibold text-[14px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <span className="flex items-center gap-2"><CalendarDays size={16} className="text-[var(--green)]" /> Schedule</span>
          <ArrowUpRight size={14} className="text-[var(--ink-faint)]" />
        </Link>
        <Link href="/electrician/packages" className="inline-flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] rounded-xl px-4 py-3 font-semibold text-[14px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <span className="flex items-center gap-2"><Package size={16} className="text-[var(--amber-deep)]" /> Packages</span>
          <span className="text-[11px] font-bold text-[var(--ink-faint)] bg-[var(--app-bg)] rounded-full px-2 py-0.5">{packageCount} ready</span>
        </Link>
        <Link href="/electrician/comms" className="inline-flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] rounded-xl px-4 py-3 font-semibold text-[14px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <span className="flex items-center gap-2"><Bell size={16} className="text-purple-500" /> Comms</span>
          <ArrowUpRight size={14} className="text-[var(--ink-faint)]" />
        </Link>
        <Link href="/electrician/margins" className="inline-flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] rounded-xl px-4 py-3 font-semibold text-[14px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <span className="flex items-center gap-2"><TrendingUp size={16} className="text-[var(--green)]" /> Profit detail</span>
          <ArrowUpRight size={14} className="text-[var(--ink-faint)]" />
        </Link>
      </div>
    </div>
  );
}
