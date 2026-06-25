export interface QuoteForStats {
  status: string;
  total_cost: number | null;
  amount_paid: number | null;
  created_at: string;
  follow_up_at?: string | null;
  quote_expires_at?: string | null;
  sent_at?: string | null;
  labour_hours?: number | null;
  materials_cost?: number | null;
}

export interface DashboardStats {
  totalQuotes: number;
  byStatus: Record<string, number>;
  totalQuotedValue: number;
  totalWonValue: number;
  totalOutstanding: number;
  totalCollected: number;
  winRate: number | null;
  avgJobValue: number | null;
  activeJobsCount: number;
  activeJobsValue: number;
  monthly: { label: string; count: number; value: number }[];
  overdueFollowUps: number;
  expiredQuotes: number;
  avgLabourHours: number | null;
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function computeDashboardStats(quotes: QuoteForStats[]): DashboardStats {
  const byStatus: Record<string, number> = { draft: 0, sent: 0, accepted: 0, declined: 0, paid: 0 };
  let totalQuotedValue = 0, totalWonValue = 0, totalOutstanding = 0, totalCollected = 0;
  let decidedCount = 0, wonCount = 0, activeJobsCount = 0, activeJobsValue = 0;
  let overdueFollowUps = 0, expiredQuotes = 0;
  let totalLabourHours = 0, labourCount = 0;

  for (const q of quotes) {
    const status = q.status in byStatus ? q.status : "draft";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    const cost = q.total_cost ?? 0;
    const paid = q.amount_paid ?? 0;
    totalCollected += paid;
    if (status !== "draft") { totalQuotedValue += cost; decidedCount += 1; }
    if (status === "accepted" || status === "paid") { totalWonValue += cost; wonCount += 1; }
    if (status === "accepted") {
      totalOutstanding += Math.max(cost - paid, 0);
      activeJobsCount += 1;
      activeJobsValue += cost;
    }
    if (status === "sent") {
      if (q.follow_up_at && daysUntil(q.follow_up_at)! < 0) overdueFollowUps++;
      if (q.quote_expires_at && daysUntil(q.quote_expires_at)! < 0) expiredQuotes++;
    }
    if (q.labour_hours) { totalLabourHours += q.labour_hours; labourCount++; }
  }

  const winRate = decidedCount > 0 ? Math.round((wonCount / decidedCount) * 1000) / 10 : null;
  const avgJobValue = wonCount > 0 ? Math.round(totalWonValue / wonCount) : null;
  const avgLabourHours = labourCount > 0 ? Math.round((totalLabourHours / labourCount) * 10) / 10 : null;

  const now = new Date();
  const months: { key: string; label: string; count: number; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-AU", { month: "short" }), count: 0, value: 0 });
  }
  for (const q of quotes) {
    const d = new Date(q.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const month = months.find((m) => m.key === key);
    if (month) { month.count++; month.value += q.total_cost ?? 0; }
  }

  return { totalQuotes: quotes.length, byStatus, totalQuotedValue, totalWonValue, totalOutstanding, totalCollected, winRate, avgJobValue, activeJobsCount, activeJobsValue, monthly: months.map(({ label, count, value }) => ({ label, count, value })), overdueFollowUps, expiredQuotes, avgLabourHours };
}
