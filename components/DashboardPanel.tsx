"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Briefcase,
  CalendarDays,
  Bell,
  AlertTriangle,
  Package,
} from "lucide-react";

interface Stats {
  openQuotes: number;
  sentQuotes: number;
  acceptedQuotes: number;
  paidQuotes: number;
  totalRevenue: number;
  conversionRate: number;
  avgQuoteValue: number;
  followUpsDue: number;
  quotesExpiringSoon: number;
}

interface ProfitStats {
  quotedValue: number;
  actualRevenue: number;
  labourCost: number;
  materialCost: number;
  unexpectedCost: number;
  profit: number;
  marginPct: number;
  avgJobProfit: number;
  completedJobs: number;
  profitableJobs: number;
  unprofitableJobs: number;
  labourVariance: number;
  materialVariance: number;
}

export default function DashboardPanel({ stats, profit }: { stats: Stats; profit: ProfitStats }) {
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

  return (
    <div className="page-wrap">
      <h1 className="font-display text-[28px] text-[var(--ink)] mb-5">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={14} className="text-[var(--blue)]" />
            <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Open quotes</span>
          </div>
          <p className="font-display text-[24px] text-[var(--ink)]">{stats.openQuotes}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-[var(--green)]" />
            <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Accepted</span>
          </div>
          <p className="font-display text-[24px] text-[var(--ink)]">{stats.acceptedQuotes}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-[var(--amber-deep)]" />
            <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Revenue</span>
          </div>
          <p className="font-display text-[24px] text-[var(--ink)]">${stats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-purple-500" />
            <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Conversion</span>
          </div>
          <p className="font-display text-[24px] text-[var(ink)]">{stats.conversionRate.toFixed(0)}%</p>
        </div>
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {stats.followUpsDue > 0 && (
          <Link href="/electrician/quotes?status=sent" className="flex items-center gap-3 bg-[var(--blue-bg)] border border-blue-200 rounded-xl px-4 py-3">
            <Bell size={16} className="text-[var(--blue)] shrink-0" />
            <div>
              <p className="text-[13px] font-bold text-[var(--blue)]">{stats.followUpsDue} follow-up{stats.followUpsDue !== 1 ? "s" : ""} due</p>
              <p className="text-[11px] text-blue-600">Check sent quotes</p>
            </div>
          </Link>
        )}
        {stats.quotesExpiringSoon > 0 && (
          <Link href="/electrician/quotes?status=sent" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <div>
              <p className="text-[13px] font-bold text-amber-800">{stats.quotesExpiringSoon} quote{stats.quotesExpiringSoon !== 1 ? "s" : ""} expiring soon</p>
              <p className="text-[11px] text-amber-600">Send reminders</p>
            </div>
          </Link>
        )}
      </div>

      {/* Profit section */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-[var(--green)]" />
          <h2 className="font-bold text-[17px] text-[var(ink)]">Profit snapshot</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide mb-1">Quoted value</p>
            <p className="font-display text-[18px] text-[var(ink)]">${profit.quotedValue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[var(ink-faint)] uppercase tracking-wide mb-1">Actual profit</p>
            <p className={`font-display text-[18px] ${profit.profit >= 0 ? "text-[var(--green)]" : "text-[var(red)]"}`}>
              ${Math.round(profit.profit).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[var(ink-faint)] uppercase tracking-wide mb-1">Margin</p>
            <p className={`font-display text-[18px] ${profit.marginPct >= 25 ? "text-[var(--green)]" : profit.marginPct >= 10 ? "text-[var(--amber-deep)]" : "text-[var(--red)]"}`}>
              {profit.marginPct.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[var(ink-faint)] uppercase tracking-wide mb-1">Completed jobs</p>
            <p className="font-display text-[18px] text-[var(ink)]">{profit.completedJobs}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Link href="/electrician" className="inline-flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] rounded-xl px-4 py-3 font-semibold text-[14px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <span className="flex items-center gap-2"><Zap size={16} className="text-[var(--amber)]" /> New quote</span>
          <ArrowUpRight size={14} className="text-[var(--ink-faint)]" />
        </Link>
        <Link href="/electrician/jobs" className="inline-flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--line)] text-[var(ink)] rounded-xl px-4 py-3 font-semibold text-[14px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <span className="flex items-center gap-2"><Briefcase size={16} className="text-[var(--blue)]" /> Jobs</span>
          <ArrowUpRight size={14} className="text-[var(ink-faint)]" />
        </Link>
        <Link href="/electrician/schedule" className="inline-flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--line)] text-[var(ink)] rounded-xl px-4 py-3 font-semibold text-[14px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <span className="flex items-center gap-2"><CalendarDays size={16} className="text-[var(--green)]" /> Schedule</span>
          <ArrowUpRight size={14} className="text-[var(ink-faint)]" />
        </Link>
        <Link href="/electrician/packages" className="inline-flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--line)] text-[var(ink)] rounded-xl px-4 py-3 font-semibold text-[14px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <span className="flex items-center gap-2"><Package size={16} className="text-[var(--amber-deep)]" /> Packages</span>
          <span className="text-[11px] font-bold text-[var(--ink-faint)] bg-[var(--app-bg)] rounded-full px-2 py-0.5">{packageCount} ready</span>
        </Link>
        <Link href="/electrician/comms" className="inline-flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--line)] text-[var(ink)] rounded-xl px-4 py-3 font-semibold text-[14px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <span className="flex items-center gap-2"><Bell size={16} className="text-purple-500" /> Comms</span>
          <ArrowUpRight size={14} className="text-[var(ink-faint)]" />
        </Link>
        <Link href="/electrician/margins" className="inline-flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--line)] text-[var(ink)] rounded-xl px-4 py-3 font-semibold text-[14px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <span className="flex items-center gap-2"><TrendingUp size={16} className="text-[var(--green)]" /> Profit detail</span>
          <ArrowUpRight size={14} className="text-[var(ink-faint)]" />
        </Link>
      </div>
    </div>
  );
}
