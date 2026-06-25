import type { DashboardStats } from "@/lib/dashboardStats";
import {
  Briefcase,
  TrendingUp,
  Target,
  DollarSign,
  Wallet,
  Clock,
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  BadgeCheck,
  Bell,
  AlertTriangle,
  CalendarDays,
  Users,
} from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  draft: { label: "Draft", color: "var(--ink-faint)", icon: FileText },
  sent: { label: "Sent", color: "#3b82f6", icon: Send },
  accepted: { label: "Accepted", color: "var(--amber)", icon: CheckCircle2 },
  paid: { label: "Paid", color: "#16a34a", icon: BadgeCheck },
  declined: { label: "Declined", color: "#dc2626", icon: XCircle },
};
const STATUS_ORDER = ["draft", "sent", "accepted", "paid", "declined"];

export default function DashboardPanel({ stats }: { stats: DashboardStats }) {
  const maxMonthly = Math.max(...stats.monthly.map((m) => m.value), 1);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl sm:text-3xl text-[var(--ink)]">Dashboard</h1>
      </div>

      {stats.totalQuotes === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-10 text-center">
          <Briefcase size={28} className="mx-auto mb-3 text-[var(--ink-faint)]" />
          <p className="text-[var(--ink-faint)] text-sm">
            No quotes yet — once you start raising and sending quotes, your numbers will show up here.
          </p>
        </div>
      ) : (
        <>
          {/* HERO: ACTIVE JOBS - the headline metric, since accepted quotes are now work owed */}
          <div
            className="bg-[var(--navy)] rounded-2xl p-5 sm:p-6 mb-5 grid sm:grid-cols-[auto_1fr_auto] gap-4 sm:gap-6 items-center"
            style={{ boxShadow: "0 16px 32px rgba(10,23,34,.16)" }}
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--amber)]/15 flex items-center justify-center">
              <Briefcase size={22} className="text-[var(--amber)]" />
            </div>
            <div>
              <p className="text-[11px] tracking-[.14em] uppercase text-[var(--steel-3)] font-bold mb-1">Active jobs</p>
              <p className="font-display text-3xl text-white leading-none">
                {stats.activeJobsCount}
                <span className="text-base text-[var(--steel-2)] font-sans font-medium ml-2">
                  worth ${stats.activeJobsValue.toLocaleString()}
                </span>
              </p>
              <p className="text-[13px] text-[var(--steel-2)] mt-1">Accepted, not yet fully paid</p>
            </div>
            <a
              href="/electrician/jobs"
              className="bg-[var(--amber)] text-[var(--navy)] text-sm font-bold px-4 py-2.5 rounded-lg text-center whitespace-nowrap"
            >
              View jobs →
            </a>
          </div>

          {/* ACTION ALERTS */}
          {(stats.overdueFollowUps > 0 || stats.expiredQuotes > 0) && (
            <div className="flex flex-col gap-2 mb-5">
              {stats.overdueFollowUps > 0 && (
                <a href="/electrician/quotes" className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700">
                  <Bell size={16} className="shrink-0" />
                  <span className="text-[13.5px] font-semibold">{stats.overdueFollowUps} overdue follow-up{stats.overdueFollowUps !== 1 ? "s" : ""} — check your sent quotes</span>
                </a>
              )}
              {stats.expiredQuotes > 0 && (
                <a href="/electrician/quotes" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span className="text-[13.5px] font-semibold">{stats.expiredQuotes} expired quote{stats.expiredQuotes !== 1 ? "s" : ""} — resend with updated pricing</span>
                </a>
              )}
            </div>
          )}

          {/* QUICK LINKS */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <a href="/electrician" className="bg-[var(--amber)] text-[var(--navy)] rounded-xl p-3 text-center font-bold text-sm">+ New quote</a>
            <a href="/electrician/schedule" className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-3 text-center font-semibold text-[13px] text-[var(--ink)] flex flex-col items-center gap-1"><CalendarDays size={16} className="text-[var(--ink-faint)]" />Schedule</a>
            <a href="/electrician/clients" className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-3 text-center font-semibold text-[13px] text-[var(--ink)] flex flex-col items-center gap-1"><Users size={16} className="text-[var(--ink-faint)]" />Clients</a>
          </div>

          {/* SECONDARY STATS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
            <StatCard icon={FileText} label="Quotes raised" value={stats.totalQuotes.toString()} />
            <StatCard
              icon={Target}
              label="Win rate"
              value={stats.winRate !== null ? `${stats.winRate}%` : "—"}
              sub={stats.winRate === null ? "No decided quotes yet" : undefined}
            />
            <StatCard icon={TrendingUp} label="Avg job value" value={stats.avgJobValue !== null ? `$${stats.avgJobValue.toLocaleString()}` : "—"} />
            <StatCard icon={DollarSign} label="Total quoted" value={`$${stats.totalQuotedValue.toLocaleString()}`} accent />
            <StatCard icon={BadgeCheck} label="Total won" value={`$${stats.totalWonValue.toLocaleString()}`} accent />
            <StatCard icon={Clock} label="Outstanding" value={`$${stats.totalOutstanding.toLocaleString()}`} warn={stats.totalOutstanding > 0} />
            {stats.avgLabourHours !== null && <StatCard icon={Clock} label="Avg labour hrs" value={`${stats.avgLabourHours}h`} />}
            <StatCard icon={Wallet} label="Collected" value={`$${stats.totalCollected.toLocaleString()}`} success />
          </div>

          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-5">
            {/* MONTHLY CHART */}
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5">
              <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Trend</p>
              <p className="font-semibold text-[var(--ink)] mb-4">Quoted value by month</p>
              <div className="flex items-end justify-between gap-2 sm:gap-3 h-40 border-b border-[var(--line)] pb-0">
                {stats.monthly.map((m) => (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end" title={`${m.label}: $${m.value.toLocaleString()} across ${m.count} quote(s)`}>
                    <span className="text-[11px] text-[var(--ink-faint)] font-semibold tabular">
                      {m.value > 0 ? `$${Math.round(m.value / 1000)}k` : ""}
                    </span>
                    <div
                      className="w-full rounded-t-md transition-all"
                      style={{
                        height: `${Math.max((m.value / maxMonthly) * 100, m.value > 0 ? 5 : 2)}px`,
                        background: m.value > 0 ? "linear-gradient(180deg, var(--amber) 0%, var(--navy) 100%)" : "var(--line)",
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between gap-2 sm:gap-3 mt-2">
                {stats.monthly.map((m) => (
                  <span key={m.label} className="flex-1 text-center text-[11px] text-[var(--ink-faint)] font-medium">
                    {m.label}
                  </span>
                ))}
              </div>
            </div>

            {/* STATUS BREAKDOWN */}
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5">
              <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Pipeline</p>
              <p className="font-semibold text-[var(--ink)] mb-4">Quotes by status</p>

              <div className="flex h-2.5 rounded-full overflow-hidden mb-4 bg-[var(--app-bg)]">
                {STATUS_ORDER.map((s) =>
                  stats.byStatus[s] > 0 ? (
                    <div
                      key={s}
                      style={{ width: `${(stats.byStatus[s] / stats.totalQuotes) * 100}%`, background: STATUS_META[s].color }}
                    />
                  ) : null
                )}
              </div>

              <div className="space-y-2.5">
                {STATUS_ORDER.map((s) => {
                  const Icon = STATUS_META[s].icon;
                  return (
                    <div key={s} className="flex items-center gap-2.5">
                      <Icon size={15} style={{ color: STATUS_META[s].color }} />
                      <span className="text-[13.5px] text-[var(--ink-soft)] flex-1">{STATUS_META[s].label}</span>
                      <span className="text-[14px] font-bold text-[var(--ink)] tabular">{stats.byStatus[s]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  warn,
  success,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
  success?: boolean;
}) {
  const valueColor = warn ? "text-red-600" : success ? "text-green-700" : accent ? "text-[var(--amber-deep)]" : "text-[var(--ink)]";
  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-[var(--ink-faint)]" />
        <p className="text-[11px] text-[var(--ink-faint)] font-semibold">{label}</p>
      </div>
      <p className={`font-display text-xl sm:text-2xl ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--ink-faint)] mt-0.5">{sub}</p>}
    </div>
  );
}
