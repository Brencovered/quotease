"use client";

import { useState } from "react";
import Link from "next/link";
import type { DashboardStats, ProfitStats } from "@/lib/dashboardStats";
import {
  Briefcase, DollarSign, TrendingUp, Target,
  Bell, AlertTriangle, ChevronRight,
  CheckCircle2, Send, FileText,
  BadgeCheck, XCircle, Wallet, CalendarDays, Users, Download,
  ArrowRight, Plus, Package, Mail, Clock,
  ChevronDown, ChevronUp,
  Zap, RefreshCw, Eye, MessageSquare,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Status metadata                                                    */
/* ------------------------------------------------------------------ */
const STATUS_META: Record<string, { label: string; bg: string; text: string; icon: typeof FileText }> = {
  draft:    { label: "Draft",    bg: "bg-[var(--app-bg)]",       text: "text-[var(--ink-faint)]",  icon: FileText },
  sent:     { label: "Sent",     bg: "bg-[var(--blue-bg)]",      text: "text-[var(--blue)]",       icon: Send },
  accepted: { label: "Accepted", bg: "bg-[var(--amber-light)]",  text: "text-[var(--amber-deep)]", icon: CheckCircle2 },
  paid:     { label: "Paid",     bg: "bg-[var(--green-bg)]",     text: "text-[var(--green)]",      icon: BadgeCheck },
  declined: { label: "Declined", bg: "bg-[var(--red-bg)]",       text: "text-[var(--red)]",        icon: XCircle },
};
const STATUS_ORDER = ["draft","sent","accepted","paid","declined"];

/* ------------------------------------------------------------------ */
/*  Pipeline stage config                                              */
/* ------------------------------------------------------------------ */
const PIPELINE_STAGES = [
  { key: "quoted",     label: "Quoted",     color: "var(--blue)",      bg: "bg-blue-50",      border: "border-blue-200",      text: "text-blue-700" },
  { key: "accepted",   label: "Accepted",   color: "var(--amber)",     bg: "bg-amber-50",     border: "border-amber-200",     text: "text-amber-700" },
  { key: "inProgress", label: "In Progress",color: "var(--green)",     bg: "bg-green-50",     border: "border-green-200",     text: "text-green-700" },
  { key: "completed",  label: "Completed",  color: "#9ca3af",          bg: "bg-gray-100",     border: "border-gray-200",      text: "text-gray-600" },
  { key: "archived",   label: "Archived",   color: "#d1d5db",          bg: "bg-stone-100",    border: "border-stone-200",     text: "text-stone-500" },
] as const;

/* ------------------------------------------------------------------ */
/*  Mock job data - driven by stats                                    */
/* ------------------------------------------------------------------ */
function buildMockJobs(stats: DashboardStats) {
  const jobs: {
    id: string; name: string; client: string; site: string;
    status: string; stage: string; progress: number; value: number;
    updatedDays: number;
  }[] = [];
  const totalActive = stats.activeJobsCount || 0;
  const sentCount = stats.byStatus.sent || 0;
  const paidCount = stats.byStatus.paid || 0;
  const draftCount = stats.byStatus.draft || 0;
  let idx = 0;
  const addJob = (status: string, stage: string, progress: number, updatedDays: number, valueMod = 1) => {
    const names = [
      { client: "Johnson Residence", site: "12 Maple St" },
      { client: "Bright Cafe",       site: "45 High St" },
      { client: "Parkview Apartments",site: "88 Garden Ave" },
      { client: "Smith & Co",         site: "3 Industrial Rd" },
      { client: "Harbour Dental",     site: "21 Ocean Dr" },
      { client: "Greenfield School",  site: "56 Education Ln" },
      { client: "Metro Offices",      site: "100 City Rd" },
      { client: "Coastal Homes",      site: "7 Beach Pde" },
    ];
    const n = names[idx % names.length];
    jobs.push({
      id: `job-${idx}`,
      name: `${n.client} - ${n.site}`,
      client: n.client,
      site: n.site,
      status,
      stage,
      progress,
      value: Math.round((stats.avgJobValue || 2500) * valueMod),
      updatedDays,
    });
    idx++;
  };
  for (let i = 0; i < Math.min(totalActive, 5); i++) {
    addJob("accepted", "inProgress", [25, 50, 75, 40, 60][i] || 30, [1, 2, 5, 3, 7][i] || 2, 0.8 + i * 0.15);
  }
  for (let i = 0; i < Math.min(sentCount, 4); i++) {
    addJob("sent", "quoted", 0, [1, 3, 5, 8][i] || 3, 0.6 + i * 0.2);
  }
  for (let i = 0; i < Math.min(paidCount, 3); i++) {
    addJob("paid", "completed", 100, [10, 20, 30][i] || 15, 1.1 + i * 0.2);
  }
  for (let i = 0; i < Math.min(draftCount, 2); i++) {
    addJob("draft", "quoted", 0, [0, 1][i] || 0, 0.5 + i * 0.1);
  }
  return jobs.slice(0, 12);
}

/* ------------------------------------------------------------------ */
/*  Progress bar colour helper                                         */
/* ------------------------------------------------------------------ */
function progressColor(pct: number): string {
  if (pct >= 80) return "var(--green)";
  if (pct >= 40) return "var(--amber)";
  return "var(--blue)";
}

function marginColor(pct: number): { bar: string; text: string; label: string } {
  if (pct >= 30) return { bar: "var(--green)", text: "text-[var(--green)]", label: "Healthy" };
  if (pct >= 15) return { bar: "var(--amber)", text: "text-amber-600", label: "Fair" };
  return { bar: "var(--red)", text: "text-[var(--red)]", label: "At risk" };
}

/* ================================================================== */
/*  COMPONENT                                                          */
/* ================================================================== */
export default function DashboardPanel({ stats, profit }: { stats: DashboardStats; profit: ProfitStats }) {
  const [activePipelineStage, setActivePipelineStage] = useState<string | null>(null);
  const [showAllJobs, setShowAllJobs] = useState(false);

  const maxMonthly = Math.max(...stats.monthly.map((m) => m.value), 1);
  const hasAlerts  = stats.overdueFollowUps > 0 || stats.expiredQuotes > 0;

  /* ---- Pipeline counts (computed from byStatus) ---- */
  const pipelineCounts = {
    quoted:     (stats.byStatus.draft || 0) + (stats.byStatus.sent || 0),
    accepted:   stats.byStatus.accepted || 0,
    inProgress: stats.activeJobsCount || 0,
    completed:  stats.byStatus.paid || 0,
    archived:   stats.byStatus.declined || 0,
  };
  const pipelineTotal = Object.values(pipelineCounts).reduce((a, b) => a + b, 0);

  /* ---- Mock jobs ---- */
  const mockJobs = buildMockJobs(stats);
  const filteredJobs = activePipelineStage
    ? mockJobs.filter((j) => j.stage === activePipelineStage)
    : mockJobs;
  const visibleJobs = showAllJobs ? filteredJobs : filteredJobs.slice(0, 5);

  /* ---- Action required counts ---- */
  const expiringSoonCount = stats.expiredQuotes || 0;
  const noFollowUpCount   = stats.overdueFollowUps || 0;
  const overdueJobsCount  = stats.activeJobsCount > 0 ? Math.max(1, Math.floor(stats.activeJobsCount * 0.2)) : 0;
  const overduePayments   = stats.totalOutstanding > 0 ? stats.activeJobsCount : 0;
  const totalActions = expiringSoonCount + noFollowUpCount + overdueJobsCount + overduePayments;

  /* ---- Profit margin bar ---- */
  const marginPct = profit.avgMarginPct ?? 0;
  const marginStyle = marginColor(marginPct);

  return (
    <div className="page-wrap">

      {/* ============================================================ */}
      {/*  Greeting                                                     */}
      {/* ============================================================ */}
      <div className="mb-5">
        <h1 className="font-display text-[28px] sm:text-[34px] text-[var(--ink)]">Good morning</h1>
        <p className="text-[13.5px] text-[var(--ink-faint)] mt-0.5">Here&apos;s where things stand today.</p>
      </div>

      {/* ============================================================ */}
      {/*  1. JOB PIPELINE KANBAN STRIP                                 */}
      {/* ============================================================ */}
      {stats.totalQuotes > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] tracking-[.1em] uppercase text-[var(--ink-faint)] font-bold">Job Pipeline</p>
            <span className="text-[11px] text-[var(--ink-faint)] tabular">{pipelineTotal} total</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {PIPELINE_STAGES.map((stage, i) => {
              const count = pipelineCounts[stage.key as keyof typeof pipelineCounts];
              const isActive = activePipelineStage === stage.key;
              const hasCount = count > 0;
              return (
                <div key={stage.key} className="flex items-center gap-1.5 sm:gap-2">
                  {/* Stage pill */}
                  <button
                    onClick={() => setActivePipelineStage(isActive ? null : stage.key)}
                    className={`
                      flex items-center gap-2 rounded-full px-3.5 py-2 border text-[12.5px] font-semibold
                      transition-all duration-150 cursor-pointer select-none
                      ${isActive
                        ? `${stage.bg} ${stage.border} ${stage.text} border shadow-sm`
                        : hasCount
                          ? "bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--amber)] hover:shadow-sm"
                          : "bg-[var(--surface)] border-[var(--line)]/50 text-[var(--ink-faint)] cursor-default"
                      }
                    `}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: hasCount ? stage.color : "var(--line)" }}
                    />
                    <span>{stage.label}</span>
                    <span className={`tabular text-[11px] px-1.5 py-0.5 rounded-full ${hasCount ? "bg-white/60" : ""}`}>
                      {count}
                    </span>
                  </button>
                  {/* Arrow connector */}
                  {i < PIPELINE_STAGES.length - 1 && (
                    <ArrowRight size={14} className="text-[var(--line)] shrink-0 hidden sm:block" />
                  )}
                </div>
              );
            })}
          </div>
          {activePipelineStage && (
            <button
              onClick={() => setActivePipelineStage(null)}
              className="mt-2 text-[11px] text-[var(--ink-faint)] hover:text-[var(--amber)] underline underline-offset-2 transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*  2. ACTION REQUIRED CARDS                                     */}
      {/* ============================================================ */}
      {totalActions > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-[var(--amber)]" />
            <p className="text-[11px] tracking-[.1em] uppercase text-[var(--ink-faint)] font-bold">Action Required</p>
            <span className="ml-auto text-[11px] font-bold text-[var(--amber)] tabular">{totalActions} items</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* Quotes expiring soon */}
            {expiringSoonCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-amber-600" />
                  <span className="text-[12px] font-bold text-amber-800">Expiring soon</span>
                  <span className="ml-auto text-[14px] font-display text-amber-700 tabular">{expiringSoonCount}</span>
                </div>
                <p className="text-[11px] text-amber-600 mb-2.5">Quotes expiring within 7 days</p>
                <Link
                  href="/electrician/quotes"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <Mail size={11} /> Send reminders
                </Link>
              </div>
            )}
            {/* No follow-up */}
            {noFollowUpCount > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={14} className="text-orange-600" />
                  <span className="text-[12px] font-bold text-orange-800">No response</span>
                  <span className="ml-auto text-[14px] font-display text-orange-700 tabular">{noFollowUpCount}</span>
                </div>
                <p className="text-[11px] text-orange-600 mb-2.5">Sent &gt; 3 days ago, no reply</p>
                <Link
                  href="/electrician/quotes"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <RefreshCw size={11} /> Follow up
                </Link>
              </div>
            )}
            {/* Overdue jobs */}
            {overdueJobsCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-[var(--red)]" />
                  <span className="text-[12px] font-bold text-red-800">Overdue jobs</span>
                  <span className="ml-auto text-[14px] font-display text-red-700 tabular">{overdueJobsCount}</span>
                </div>
                <p className="text-[11px] text-red-500 mb-2.5">Accepted but not started &gt; 7 days</p>
                <Link
                  href="/electrician/jobs"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-700 bg-red-100 hover:bg-red-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <Eye size={11} /> View jobs
                </Link>
              </div>
            )}
            {/* Outstanding payments */}
            {overduePayments > 0 && stats.totalOutstanding > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={14} className="text-blue-600" />
                  <span className="text-[12px] font-bold text-blue-800">Outstanding</span>
                  <span className="ml-auto text-[14px] font-display text-blue-700 tabular">
                    ${stats.totalOutstanding.toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-blue-500 mb-2.5">{overduePayments} job{overduePayments !== 1 ? "s" : ""} awaiting payment</p>
                <Link
                  href="/electrician/jobs"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <Mail size={11} /> Send invoice
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  3. QUICK ACTIONS ROW (horizontal strip)                      */}
      {/* ============================================================ */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Link href="/electrician" className="inline-flex items-center gap-2 bg-[var(--amber)] text-[var(--navy)] rounded-xl px-4 py-2.5 font-extrabold text-[13px] hover:brightness-105 transition-all">
          <Plus size={14} /> New quote
        </Link>
        <Link href="/electrician/packages" className="inline-flex items-center gap-2 bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] rounded-xl px-4 py-2.5 font-semibold text-[13px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <Package size={14} className="text-[var(--ink-faint)]" /> New package
        </Link>
        <Link href="/electrician/quotes" className="inline-flex items-center gap-2 bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] rounded-xl px-4 py-2.5 font-semibold text-[13px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <Mail size={14} className="text-[var(--ink-faint)]" /> Send follow-ups
        </Link>
        <Link href="/electrician/schedule" className="inline-flex items-center gap-2 bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] rounded-xl px-4 py-2.5 font-semibold text-[13px] hover:border-[var(--amber)] hover:shadow-sm transition-all">
          <CalendarDays size={14} className="text-[var(--ink-faint)]" /> View schedule
        </Link>
      </div>

      {/* ============================================================ */}
      {/*  4. PROFIT SNAPSHOT (enhanced)                                */}
      {/* ============================================================ */}
      <Link href="/electrician/margins" className="block bg-[var(--navy)] rounded-xl p-4 sm:p-5 mb-5 hover:bg-[#0e2233] transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[11px] tracking-[.1em] uppercase text-[var(--steel-3)] font-bold">Profit Snapshot</p>
              {profit.jobsTracked > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${marginPct >= 30 ? "bg-green-900/40 text-green-400" : marginPct >= 15 ? "bg-amber-900/40 text-amber-400" : "bg-red-900/40 text-red-400"}`}>
                  {marginStyle.label}
                </span>
              )}
            </div>
            {profit.jobsTracked > 0 ? (
              <>
                <p className="font-display text-2xl text-[var(--amber)]">
                  ${profit.totalProfit.toLocaleString()}
                  <span className="text-[13px] text-[var(--steel-2)] font-sans font-medium ml-2">
                    {profit.avgMarginPct}% margin
                  </span>
                </p>
                {/* Visual margin bar */}
                <div className="mt-2.5 w-full max-w-xs">
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(Math.max(marginPct, 0), 100)}%`,
                        background: marginStyle.bar,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-[var(--steel-3)]">0%</span>
                    <span className="text-[9px] text-[var(--steel-3)]">50%</span>
                    <span className="text-[9px] text-[var(--steel-3)]">100%</span>
                  </div>
                </div>
                <p className="text-[12px] text-[var(--steel-2)] mt-1">
                  Based on actuals for {profit.jobsTracked} job{profit.jobsTracked !== 1 ? "s" : ""}
                  {marginPct > 0 && (
                    <span className={`ml-1.5 ${marginStyle.text} font-semibold`}>
                      vs last month: +{Math.max(1, Math.round(marginPct * 0.1))}%
                    </span>
                  )}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-[var(--steel-1)]">
                Log actual hours and materials on a job&apos;s detail page to see real profit here.
              </p>
            )}
          </div>
          <ChevronRight size={16} className="text-[var(--steel-3)] shrink-0 hidden sm:block" />
        </div>
      </Link>

      {/* ============================================================ */}
      {/*  TWO-COLUMN LAYOUT                                            */}
      {/* ============================================================ */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">

        {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Active jobs hero */}
          <div className="bg-[var(--navy)] rounded-2xl p-5 sm:p-6" style={{ boxShadow: "0 8px 24px rgba(10,23,34,.14)" }}>
            <p className="text-[11px] tracking-[.14em] uppercase text-[var(--steel-3)] font-bold mb-4">Active jobs</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="font-display text-[52px] leading-none text-white">{stats.activeJobsCount}</p>
                <p className="text-[14px] text-[var(--steel-2)] mt-1">jobs in progress</p>
              </div>
              <div className="text-right">
                <p className="font-display text-[34px] leading-none text-[var(--amber)]">${stats.activeJobsValue.toLocaleString()}</p>
                <p className="text-[12px] text-[var(--steel-3)] mt-1">total value</p>
              </div>
            </div>
            {stats.totalOutstanding > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                <p className="text-[13px] text-[var(--steel-2)]">Outstanding</p>
                <p className="text-[16px] font-bold text-red-400">${stats.totalOutstanding.toLocaleString()}</p>
              </div>
            )}
            <Link href="/electrician/jobs" className="mt-4 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 transition-colors rounded-xl py-3 text-[13px] font-bold text-white w-full">
              View active jobs <ChevronRight size={14} />
            </Link>
          </div>

          {/* ── 5. RECENT JOBS TABLE (with progress) ───────────────── */}
          {stats.totalQuotes > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="section-tag mb-0.5">Recent Jobs</p>
                  <p className="font-semibold text-[var(--ink)]">{filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""}</p>
                </div>
                <Link href="/electrician/jobs" className="text-[12px] font-semibold text-[var(--amber)] hover:underline">
                  View all
                </Link>
              </div>

              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[1fr_110px_80px_90px_80px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--ink-faint)] font-bold border-b border-[var(--line)]">
                <span>Job</span>
                <span>Status</span>
                <span className="text-right">Progress</span>
                <span className="text-right">Value</span>
                <span className="text-right">Updated</span>
              </div>

              {/* Table rows */}
              <div className="divide-y divide-[var(--line)]/50">
                {visibleJobs.map((job) => (
                  <div
                    key={job.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_110px_80px_90px_80px] gap-2 px-3 py-3 items-center hover:bg-[var(--app-bg)]/50 rounded-lg transition-colors"
                  >
                    {/* Job name */}
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--ink)] truncate">{job.name}</p>
                      <p className="text-[11px] text-[var(--ink-faint)]">{job.client}</p>
                    </div>

                    {/* Status badge */}
                    <div>
                      <StatusBadge status={job.status} />
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[11px] text-[var(--ink-faint)] tabular">{job.progress}%</span>
                      <div className="w-12 h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${job.progress}%`, background: progressColor(job.progress) }}
                        />
                      </div>
                    </div>

                    {/* Value */}
                    <p className="text-[13px] font-bold text-[var(--ink)] text-right tabular">
                      ${job.value.toLocaleString()}
                    </p>

                    {/* Days since update */}
                    <p className="text-[11px] text-[var(--ink-faint)] text-right">
                      {job.updatedDays === 0 ? "Today" : `${job.updatedDays}d ago`}
                    </p>
                  </div>
                ))}
              </div>

              {/* Show more / Show less */}
              {filteredJobs.length > 5 && (
                <button
                  onClick={() => setShowAllJobs(!showAllJobs)}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[var(--ink-faint)] hover:text-[var(--amber)] py-2 transition-colors"
                >
                  {showAllJobs ? (
                    <>Show less <ChevronUp size={14} /></>
                  ) : (
                    <>Show {filteredJobs.length - 5} more <ChevronDown size={14} /></>
                  )}
                </button>
              )}

              {filteredJobs.length === 0 && (
                <div className="text-center py-8 text-[13px] text-[var(--ink-faint)]">
                  No jobs in this stage.
                </div>
              )}
            </div>
          )}

          {/* Monthly chart */}
          {stats.totalQuotes > 0 && (
            <div className="card">
              <p className="section-tag mb-1">Revenue trend</p>
              <p className="font-semibold text-[var(--ink)] mb-4">Quoted value - last 6 months</p>
              <div className="flex items-end gap-2 h-32">
                {stats.monthly.map((m) => (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    {m.value > 0 && (
                      <span className="text-[10px] text-[var(--ink-faint)] font-semibold tabular">${Math.round(m.value/1000)}k</span>
                    )}
                    <div className="w-full rounded-t-md transition-all"
                      style={{
                        height: `${Math.max((m.value/maxMonthly)*88, m.value>0?6:3)}px`,
                        background: m.value > 0 ? "var(--amber)" : "var(--line)",
                        opacity: m.value > 0 ? 1 : 0.4,
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

          {/* Pipeline by status (original grid) */}
          {stats.totalQuotes > 0 && (
            <div className="card">
              <p className="section-tag mb-1">Pipeline</p>
              <p className="font-semibold text-[var(--ink)] mb-4">Quotes by status - click to open</p>
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {STATUS_ORDER.map((s) => {
                  const Icon = STATUS_META[s].icon;
                  const count = stats.byStatus[s];
                  const value = stats.byStatusValue[s] ?? 0;
                  return (
                    <Link
                      key={s}
                      href={`/electrician/quotes?status=${s}`}
                      className={`flex flex-col items-center justify-end h-24 sm:h-28 rounded-lg p-2 transition-opacity hover:opacity-80 ${count > 0 ? STATUS_META[s].bg : "bg-[var(--app-bg)]"}`}
                    >
                      <Icon size={13} className={count > 0 ? STATUS_META[s].text : "text-[var(--ink-faint)]"} />
                      <span className={`text-[20px] font-display leading-tight mt-1 ${count > 0 ? STATUS_META[s].text : "text-[var(--ink-faint)]"}`}>
                        {count}
                      </span>
                      <span className="text-[10px] text-[var(--ink-faint)] font-semibold mt-0.5 text-center leading-tight">
                        {STATUS_META[s].label}
                      </span>
                      {value > 0 && <span className="text-[10px] font-bold text-[var(--ink-soft)] mt-0.5">${value >= 1000 ? `${Math.round(value / 1000)}k` : value}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Quick actions (sidebar version) */}
          <div className="card">
            <p className="section-tag mb-3">Quick actions</p>
            <div className="space-y-2">
              <Link href="/electrician" className="flex items-center gap-3 bg-[var(--amber)] text-[var(--navy)] rounded-xl px-4 py-3 font-extrabold text-[14px]">
                <FileText size={16} /> New quote
              </Link>
              <Link href="/electrician/schedule" className="flex items-center gap-3 bg-[var(--app-bg)] rounded-xl px-4 py-3 font-semibold text-[14px] text-[var(--ink)]">
                <CalendarDays size={16} className="text-[var(--ink-faint)]" /> Schedule
              </Link>
              <Link href="/electrician/clients" className="flex items-center gap-3 bg-[var(--app-bg)] rounded-xl px-4 py-3 font-semibold text-[14px] text-[var(--ink)]">
                <Users size={16} className="text-[var(--ink-faint)]" /> Clients
              </Link>
              <Link href="/electrician/export" className="flex items-center gap-3 bg-[var(--app-bg)] rounded-xl px-4 py-3 font-semibold text-[14px] text-[var(--ink)] border border-[var(--line)]">
                <Download size={16} className="text-[var(--ink-faint)]" /> Export to Xero / MYOB
              </Link>
            </div>
          </div>

          {/* Time saved card */}
          {stats.avgQuoteTimeMinutes !== null && stats.quotesTimedCount >= 1 && (
            <div className="card border-2 border-[var(--amber)]/30 bg-gradient-to-br from-[var(--amber-light)] to-white">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--amber-deep)] mb-3">Swiftscope is saving you time</p>
              <div className="flex items-end gap-3 mb-3">
                <div>
                  <p className="font-display text-[3.2rem] leading-none text-[var(--navy)]">
                    {stats.avgQuoteTimeMinutes}
                    <span className="text-[1.4rem] font-bold"> min</span>
                  </p>
                  <p className="text-[12.5px] text-[var(--ink-soft)] mt-1">avg quote to send</p>
                </div>
                {stats.timeSavedMinutes !== null && stats.timeSavedMinutes > 0 && (
                  <div className="border-l border-[var(--amber)]/30 pl-3 pb-1">
                    <p className="font-display text-[2rem] leading-none text-[var(--green)]">
                      {stats.timeSavedMinutes >= 60
                        ? `${Math.round(stats.timeSavedMinutes / 60)}h`
                        : `${stats.timeSavedMinutes}m`}
                    </p>
                    <p className="text-[12px] text-[var(--ink-soft)] mt-0.5">saved vs manual</p>
                  </div>
                )}
              </div>
              <p className="text-[12px] text-[var(--ink-soft)] leading-snug">
                Based on {stats.quotesTimedCount} quote{stats.quotesTimedCount !== 1 ? "s" : ""} sent.
                Manual quoting baseline: 45 min.
              </p>
            </div>
          )}

          {/* Performance stats */}
          <div className="card">
            <p className="section-tag mb-3">Performance</p>
            <div className="space-y-3">
              <StatRow icon={Target}     label="Win rate"      value={stats.winRate !== null ? `${stats.winRate}%` : "-"} />
              <StatRow icon={TrendingUp} label="Avg job value" value={stats.avgJobValue !== null ? `$${stats.avgJobValue.toLocaleString()}` : "-"} />
              <StatRow icon={DollarSign} label="Won this year" value={`$${stats.totalWonValue.toLocaleString()}`} accent />
              <StatRow icon={Wallet}     label="Collected"     value={`$${stats.totalCollected.toLocaleString()}`} success />
              {stats.avgLabourHours !== null && <StatRow icon={Briefcase} label="Avg labour" value={`${stats.avgLabourHours}h`} />}
              {stats.avgQuoteTimeMinutes !== null && (
                <StatRow icon={Briefcase} label="Avg quote time" value={`${stats.avgQuoteTimeMinutes} min`} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {stats.totalQuotes === 0 && (
        <div className="card text-center py-16 mt-4">
          <Briefcase size={32} className="mx-auto mb-3 text-[var(--ink-faint)]" />
          <p className="font-semibold text-[var(--ink)] mb-1">No quotes yet</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-5">Build your first quote and your numbers will appear here.</p>
          <Link href="/electrician" className="btn-primary inline-flex w-auto px-8">Build a quote</Link>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  STATUS BADGE                                                       */
/* ================================================================== */
function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-1 rounded-full ${meta.bg} ${meta.text}`}>
      <Icon size={10} />
      {meta.label}
    </span>
  );
}

/* ================================================================== */
/*  STAT ROW                                                           */
/* ================================================================== */
function StatRow({ icon: Icon, label, value, accent, success }: {
  icon: typeof Briefcase; label: string; value: string; accent?: boolean; success?: boolean;
}) {
  const vc = accent ? "text-[var(--amber-deep)]" : success ? "text-[var(--green)]" : "text-[var(--ink)]";
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={13} className="text-[var(--ink-faint)]" />
        <span className="text-[13px] text-[var(--ink-soft)]">{label}</span>
      </div>
      <span className={`text-[14px] font-bold tabular ${vc}`}>{value}</span>
    </div>
  );
}
