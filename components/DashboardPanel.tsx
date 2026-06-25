"use client";

import Link from "next/link";
import type { DashboardStats } from "@/lib/dashboardStats";
import {
  Briefcase, DollarSign, TrendingUp, Target,
  Bell, AlertTriangle, ChevronRight,
  CheckCircle2, Clock, Send, FileText,
  BadgeCheck, XCircle, Wallet,
} from "lucide-react";

const STATUS_META: Record<string, { label: string; bg: string; text: string; icon: typeof FileText }> = {
  draft:    { label: "Draft",    bg: "bg-[var(--app-bg)]",  text: "text-[var(--ink-faint)]", icon: FileText },
  sent:     { label: "Sent",     bg: "bg-[var(--blue-bg)]", text: "text-[var(--blue)]",      icon: Send },
  accepted: { label: "Accepted", bg: "bg-[var(--amber-light)]", text: "text-[var(--amber-deep)]", icon: CheckCircle2 },
  paid:     { label: "Paid",     bg: "bg-[var(--green-bg)]", text: "text-[var(--green)]",    icon: BadgeCheck },
  declined: { label: "Declined", bg: "bg-[var(--red-bg)]",  text: "text-[var(--red)]",       icon: XCircle },
};
const STATUS_ORDER = ["draft","sent","accepted","paid","declined"];

export default function DashboardPanel({ stats }: { stats: DashboardStats }) {
  const maxMonthly = Math.max(...stats.monthly.map((m) => m.value), 1);
  const hasAlerts  = stats.overdueFollowUps > 0 || stats.expiredQuotes > 0;

  return (
    <div className="page-wrap">

      {/* ── Greeting ─────────────────────────────────── */}
      <div className="mb-5">
        <h1 className="font-display text-[28px] text-[var(--ink)]">Good morning</h1>
        <p className="text-[13.5px] text-[var(--ink-faint)] mt-0.5">Here&apos;s where things stand today.</p>
      </div>

      {/* ── Action alerts ────────────────────────────── */}
      {hasAlerts && (
        <div className="space-y-2 mb-5">
          {stats.overdueFollowUps > 0 && (
            <Link href="/electrician/quotes" className="flex items-center gap-3 bg-[var(--red-bg)] border border-red-200 rounded-xl px-4 py-3">
              <Bell size={16} className="text-[var(--red)] shrink-0" />
              <div className="flex-1">
                <p className="text-[13.5px] font-bold text-[var(--red)]">
                  {stats.overdueFollowUps} overdue follow-up{stats.overdueFollowUps !== 1 ? "s" : ""}
                </p>
                <p className="text-[12px] text-red-400">Tap to review sent quotes</p>
              </div>
              <ChevronRight size={15} className="text-red-300 shrink-0" />
            </Link>
          )}
          {stats.expiredQuotes > 0 && (
            <Link href="/electrician/quotes" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-[13.5px] font-bold text-amber-700">
                  {stats.expiredQuotes} expired quote{stats.expiredQuotes !== 1 ? "s" : ""}
                </p>
                <p className="text-[12px] text-amber-500">Prices may have changed — resend</p>
              </div>
              <ChevronRight size={15} className="text-amber-300 shrink-0" />
            </Link>
          )}
        </div>
      )}

      {/* ── Active jobs hero ─────────────────────────── */}
      <div className="bg-[var(--navy)] rounded-2xl p-5 mb-4" style={{ boxShadow: "0 8px 24px rgba(10,23,34,.14)" }}>
        <p className="text-[11px] tracking-[.14em] uppercase text-[var(--steel-3)] font-bold mb-3">Active jobs</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-display text-[42px] leading-none text-white">{stats.activeJobsCount}</p>
            <p className="text-[13px] text-[var(--steel-2)] mt-1">jobs in progress</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[28px] leading-none text-[var(--amber)]">
              ${stats.activeJobsValue.toLocaleString()}
            </p>
            <p className="text-[12px] text-[var(--steel-3)] mt-1">total value</p>
          </div>
        </div>
        {stats.totalOutstanding > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
            <p className="text-[12.5px] text-[var(--steel-2)]">Outstanding</p>
            <p className="text-[15px] font-bold text-red-400">${stats.totalOutstanding.toLocaleString()}</p>
          </div>
        )}
        <Link href="/electrician/jobs" className="mt-4 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 transition-colors rounded-xl py-2.5 text-[13px] font-bold text-white w-full">
          View active jobs <ChevronRight size={14} />
        </Link>
      </div>

      {/* ── Stats row ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard icon={Target}     label="Win rate"      value={stats.winRate !== null ? `${stats.winRate}%` : "—"} sub="of sent quotes" />
        <StatCard icon={TrendingUp} label="Avg job value" value={stats.avgJobValue !== null ? `$${stats.avgJobValue.toLocaleString()}` : "—"} />
        <StatCard icon={DollarSign} label="Won this year" value={`$${stats.totalWonValue.toLocaleString()}`} accent />
        <StatCard icon={Wallet}     label="Collected"     value={`$${stats.totalCollected.toLocaleString()}`} success />
      </div>

      {/* ── Pipeline ─────────────────────────────────── */}
      {stats.totalQuotes > 0 && (
        <div className="card mb-4">
          <p className="section-tag mb-1">Pipeline</p>
          <p className="font-semibold text-[var(--ink)] mb-3">Quotes by status</p>
          <div className="flex h-2 rounded-full overflow-hidden bg-[var(--app-bg)] mb-4">
            {STATUS_ORDER.map((s) =>
              stats.byStatus[s] > 0 ? (
                <div key={s} style={{ width: `${(stats.byStatus[s] / stats.totalQuotes) * 100}%` }}
                  className={`${STATUS_META[s].bg} transition-all`} />
              ) : null
            )}
          </div>
          <div className="space-y-2">
            {STATUS_ORDER.map((s) => {
              const Icon = STATUS_META[s].icon;
              const count = stats.byStatus[s];
              if (!count) return null;
              return (
                <div key={s} className="flex items-center gap-2.5">
                  <span className={`pill ${STATUS_META[s].bg} ${STATUS_META[s].text}`}>
                    <Icon size={11} />{STATUS_META[s].label}
                  </span>
                  <div className="flex-1 h-1.5 bg-[var(--app-bg)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${STATUS_META[s].bg} border ${STATUS_META[s].text.replace("text","border")}`}
                      style={{ width: `${(count / stats.totalQuotes) * 100}%` }} />
                  </div>
                  <span className="text-[13px] font-bold text-[var(--ink)] tabular w-5 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Monthly chart ────────────────────────────── */}
      {stats.totalQuotes > 0 && (
        <div className="card mb-4">
          <p className="section-tag mb-1">Revenue trend</p>
          <p className="font-semibold text-[var(--ink)] mb-4">Quoted value — last 6 months</p>
          <div className="flex items-end gap-2 h-28">
            {stats.monthly.map((m) => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                {m.value > 0 && (
                  <span className="text-[10px] text-[var(--ink-faint)] font-semibold tabular">
                    ${Math.round(m.value / 1000)}k
                  </span>
                )}
                <div className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${Math.max((m.value / maxMonthly) * 80, m.value > 0 ? 6 : 3)}px`,
                    background: m.value > 0 ? "var(--amber)" : "var(--line)",
                    opacity: m.value > 0 ? 1 : 0.5,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {stats.monthly.map((m) => (
              <span key={m.label} className="flex-1 text-center text-[10.5px] text-[var(--ink-faint)] font-semibold">{m.label}</span>
            ))}
          </div>
        </div>
      )}

      {stats.totalQuotes === 0 && (
        <div className="card text-center py-12">
          <Briefcase size={32} className="mx-auto mb-3 text-[var(--ink-faint)]" />
          <p className="font-semibold text-[var(--ink)] mb-1">No quotes yet</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-5">Build your first quote and your numbers will show up here.</p>
          <Link href="/electrician" className="btn-primary inline-flex w-auto px-8">
            Build a quote
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent, success }: {
  icon: typeof Briefcase; label: string; value: string; sub?: string; accent?: boolean; success?: boolean;
}) {
  const vc = accent ? "text-[var(--amber-deep)]" : success ? "text-[var(--green)]" : "text-[var(--ink)]";
  return (
    <div className="card">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} className="text-[var(--ink-faint)]" />
        <p className="text-[11px] text-[var(--ink-faint)] font-bold uppercase tracking-wide">{label}</p>
      </div>
      <p className={`font-display text-[22px] leading-tight ${vc}`}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--ink-faint)] mt-0.5">{sub}</p>}
    </div>
  );
}
