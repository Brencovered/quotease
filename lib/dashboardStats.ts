export interface JobActualForStats {
  quote_id: string;
  actual_hours: number | null;
  actual_materials_cost: number | null;
  unexpected_costs?: number | null;
}

export interface ProfitStats {
  jobsTracked: number; // jobs that have at least one actuals entry logged
  totalProfit: number;
  avgMarginPct: number | null;
  jobs: { quoteId: string; quotedTotal: number; actualCost: number; profit: number; marginPct: number }[];
}

// Profit only exists where actuals have been logged - a quoted total tells
// you what you charged, not what it cost you to deliver. Rather than fake a
// number from the quote alone, this only counts jobs where the tradie has
// actually recorded what the job really took, and is honest with a zero
// state otherwise instead of showing a misleading "profit" for untracked work.
export function computeProfitStats(
  quotes: { id: string; total_cost: number | null }[],
  actuals: JobActualForStats[],
  hourlyRate: number
): ProfitStats {
  const actualsByQuote = new Map<string, { hours: number; materials: number; unexpected: number }>();
  for (const a of actuals) {
    const existing = actualsByQuote.get(a.quote_id) ?? { hours: 0, materials: 0, unexpected: 0 };
    existing.hours += a.actual_hours ?? 0;
    existing.materials += a.actual_materials_cost ?? 0;
    existing.unexpected += a.unexpected_costs ?? 0;
    actualsByQuote.set(a.quote_id, existing);
  }

  const jobs: ProfitStats["jobs"] = [];
  for (const q of quotes) {
    const actual = actualsByQuote.get(q.id);
    if (!actual) continue;
    const quotedTotal = q.total_cost ?? 0;
    const actualCost = actual.hours * hourlyRate + actual.materials + actual.unexpected;
    const profit = quotedTotal - actualCost;
    const marginPct = quotedTotal > 0 ? Math.round((profit / quotedTotal) * 1000) / 10 : 0;
    jobs.push({ quoteId: q.id, quotedTotal, actualCost, profit, marginPct });
  }

  const totalProfit = jobs.reduce((sum, j) => sum + j.profit, 0);
  const totalQuoted = jobs.reduce((sum, j) => sum + j.quotedTotal, 0);
  const avgMarginPct = totalQuoted > 0 ? Math.round((totalProfit / totalQuoted) * 1000) / 10 : null;

  return { jobsTracked: jobs.length, totalProfit, avgMarginPct, jobs };
}

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
  byStatusValue: Record<string, number>;
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
  // Time tracking
  avgQuoteTimeMinutes: number | null;  // avg time from quote created to sent
  timeSavedMinutes: number | null;     // vs 45 min manual baseline x quotes sent
  quotesTimedCount: number;            // how many quotes have both created_at and sent_at
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function computeDashboardStats(quotes: QuoteForStats[]): DashboardStats {
  const byStatus: Record<string, number> = { draft: 0, sent: 0, accepted: 0, declined: 0, paid: 0 };
  const byStatusValue: Record<string, number> = { draft: 0, sent: 0, accepted: 0, declined: 0, paid: 0 };
  let totalQuotedValue = 0, totalWonValue = 0, totalOutstanding = 0, totalCollected = 0;
  let decidedCount = 0, wonCount = 0, activeJobsCount = 0, activeJobsValue = 0;
  let overdueFollowUps = 0, expiredQuotes = 0;
  let totalLabourHours = 0, labourCount = 0;
  let totalQuoteTimeMs = 0, quotesTimedCount = 0;
  const MANUAL_BASELINE_MINS = 45; // conservative estimate for manual quoting

  for (const q of quotes) {
    const status = q.status in byStatus ? q.status : "draft";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    byStatusValue[status] = (byStatusValue[status] ?? 0) + (q.total_cost ?? 0);
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
    // Time from created to sent - only count if sent within 24 hours (avoids draft->sent days later skewing)
    if (q.sent_at && q.created_at) {
      const ms = new Date(q.sent_at).getTime() - new Date(q.created_at).getTime();
      if (ms > 0 && ms < 86400000) { totalQuoteTimeMs += ms; quotesTimedCount++; }
    }
  }

  const avgQuoteTimeMinutes = quotesTimedCount > 0
    ? Math.round(totalQuoteTimeMs / quotesTimedCount / 60000)
    : null;
  const timeSavedMinutes = avgQuoteTimeMinutes !== null && quotesTimedCount > 0
    ? Math.round((MANUAL_BASELINE_MINS - avgQuoteTimeMinutes) * quotesTimedCount)
    : null;

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

  return { totalQuotes: quotes.length, byStatus, byStatusValue, totalQuotedValue, totalWonValue, totalOutstanding, totalCollected, winRate, avgJobValue, activeJobsCount, activeJobsValue, monthly: months.map(({ label, count, value }) => ({ label, count, value })), overdueFollowUps, expiredQuotes, avgLabourHours, avgQuoteTimeMinutes, timeSavedMinutes, quotesTimedCount };
}
