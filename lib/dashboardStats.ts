export interface QuoteForStats {
  status: string;
  total_cost: number | null;
  amount_paid: number | null;
  created_at: string;
}

export interface DashboardStats {
  totalQuotes: number;
  byStatus: Record<string, number>;
  totalQuotedValue: number; // every non-draft quote, regardless of outcome
  totalWonValue: number; // accepted + paid
  totalOutstanding: number; // accepted, not yet fully paid
  totalCollected: number; // sum of amount_paid across everything
  winRate: number | null; // accepted+paid / (sent+accepted+paid+declined), as a %
  avgJobValue: number | null;
  monthly: { label: string; count: number; value: number }[]; // last 6 months, oldest first
}

export function computeDashboardStats(quotes: QuoteForStats[]): DashboardStats {
  const byStatus: Record<string, number> = { draft: 0, sent: 0, accepted: 0, declined: 0, paid: 0 };
  let totalQuotedValue = 0;
  let totalWonValue = 0;
  let totalOutstanding = 0;
  let totalCollected = 0;
  let decidedCount = 0; // sent, accepted, declined, paid - i.e. quotes that left draft and got a verdict
  let wonCount = 0;

  for (const q of quotes) {
    const status = q.status in byStatus ? q.status : "draft";
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    const cost = q.total_cost ?? 0;
    const paid = q.amount_paid ?? 0;
    totalCollected += paid;

    if (status !== "draft") {
      totalQuotedValue += cost;
      decidedCount += 1;
    }
    if (status === "accepted" || status === "paid") {
      totalWonValue += cost;
      wonCount += 1;
    }
    if (status === "accepted") {
      totalOutstanding += Math.max(cost - paid, 0);
    }
  }

  const winRate = decidedCount > 0 ? Math.round((wonCount / decidedCount) * 1000) / 10 : null;
  const avgJobValue = wonCount > 0 ? Math.round(totalWonValue / wonCount) : null;

  // Last 6 months, oldest first, including months with zero quotes so the
  // shape of the chart is consistent even for a brand-new account.
  const now = new Date();
  const months: { key: string; label: string; count: number; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("en-AU", { month: "short" }),
      count: 0,
      value: 0,
    });
  }
  for (const q of quotes) {
    const d = new Date(q.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const month = months.find((m) => m.key === key);
    if (month) {
      month.count += 1;
      month.value += q.total_cost ?? 0;
    }
  }

  return {
    totalQuotes: quotes.length,
    byStatus,
    totalQuotedValue,
    totalWonValue,
    totalOutstanding,
    totalCollected,
    winRate,
    avgJobValue,
    monthly: months.map(({ label, count, value }) => ({ label, count, value })),
  };
}
