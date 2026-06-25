import type { DashboardStats } from "@/lib/dashboardStats";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  paid: "Paid",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-[var(--ink-faint)]",
  sent: "bg-blue-500",
  accepted: "bg-amber-500",
  declined: "bg-red-500",
  paid: "bg-green-600",
};

export default function DashboardPanel({ stats }: { stats: DashboardStats }) {
  const maxMonthly = Math.max(...stats.monthly.map((m) => m.value), 1);
  const statusOrder = ["draft", "sent", "accepted", "paid", "declined"];

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-16">
      <h1 className="font-display text-2xl text-[var(--ink)] mb-5">Dashboard</h1>

      {stats.totalQuotes === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-8 text-center">
          <p className="text-[var(--ink-faint)] text-sm">
            No quotes yet — once you start raising and sending quotes, your numbers will show up here.
          </p>
        </div>
      ) : (
        <>
          {/* TOP STATS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <StatCard label="Quotes raised" value={stats.totalQuotes.toString()} />
            <StatCard
              label="Win rate"
              value={stats.winRate !== null ? `${stats.winRate}%` : "—"}
              sub={stats.winRate === null ? "No decided quotes yet" : undefined}
            />
            <StatCard label="Avg job value" value={stats.avgJobValue !== null ? `$${stats.avgJobValue.toLocaleString()}` : "—"} />
            <StatCard label="Total quoted" value={`$${stats.totalQuotedValue.toLocaleString()}`} accent />
            <StatCard label="Total won" value={`$${stats.totalWonValue.toLocaleString()}`} accent />
            <StatCard label="Outstanding" value={`$${stats.totalOutstanding.toLocaleString()}`} warn={stats.totalOutstanding > 0} />
          </div>

          {/* MONTHLY CHART */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5 mb-5">
            <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Trend</p>
            <p className="font-semibold text-[var(--ink)] mb-4">Quoted value by month</p>
            <div className="flex items-end justify-between gap-2 h-32">
              {stats.monthly.map((m) => (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[11px] text-[var(--ink-faint)] font-medium tabular">
                    {m.value > 0 ? `$${Math.round(m.value / 1000)}k` : ""}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-[var(--navy)]"
                    style={{ height: `${Math.max((m.value / maxMonthly) * 88, m.value > 0 ? 6 : 2)}px` }}
                  />
                  <span className="text-[11px] text-[var(--ink-faint)] font-medium">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* STATUS BREAKDOWN */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5 mb-5">
            <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Pipeline</p>
            <p className="font-semibold text-[var(--ink)] mb-4">Quotes by status</p>

            <div className="flex h-2.5 rounded-full overflow-hidden mb-4 bg-[var(--app-bg)]">
              {statusOrder.map((s) =>
                stats.byStatus[s] > 0 ? (
                  <div
                    key={s}
                    className={STATUS_COLOR[s]}
                    style={{ width: `${(stats.byStatus[s] / stats.totalQuotes) * 100}%` }}
                  />
                ) : null
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {statusOrder.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLOR[s]}`} />
                  <span className="text-[13px] text-[var(--ink-soft)]">{STATUS_LABEL[s]}</span>
                  <span className="text-[13px] font-semibold text-[var(--ink)] ml-auto tabular">{stats.byStatus[s]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* COLLECTED */}
          <div className="bg-[var(--navy)] rounded-xl p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] tracking-[.12em] uppercase text-[var(--steel-3)] font-bold mb-1">Collected</p>
              <p className="text-sm text-[var(--steel-1)]">Total payments recorded across all quotes</p>
            </div>
            <p className="font-display text-2xl text-[var(--amber)]">${stats.totalCollected.toLocaleString()}</p>
          </div>
        </>
      )}
    </main>
  );
}

function StatCard({ label, value, sub, accent, warn }: { label: string; value: string; sub?: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4">
      <p className="text-[11px] text-[var(--ink-faint)] font-medium mb-1">{label}</p>
      <p
        className={`font-display text-xl ${
          warn ? "text-red-600" : accent ? "text-[var(--amber-deep)]" : "text-[var(--ink)]"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-[var(--ink-faint)] mt-0.5">{sub}</p>}
    </div>
  );
}
