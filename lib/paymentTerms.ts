export type PaymentTrigger = "acceptance" | "completion" | "invoice_date";

export interface PaymentTerm {
  label: string;
  percent: number; // 0-100, all terms on a quote should sum to 100
  trigger: PaymentTrigger;
  days: number; // days after the trigger date that this portion is due
}

export const PAYMENT_TERM_PRESETS: Record<string, PaymentTerm[]> = {
  full_on_completion: [{ label: "Payment due", percent: 100, trigger: "completion", days: 14 }],
  deposit_50_50: [
    { label: "Deposit", percent: 50, trigger: "acceptance", days: 0 },
    { label: "Final payment", percent: 50, trigger: "completion", days: 7 },
  ],
  deposit_30_70: [
    { label: "Deposit", percent: 30, trigger: "acceptance", days: 0 },
    { label: "Final payment", percent: 70, trigger: "completion", days: 7 },
  ],
  due_on_invoice: [{ label: "Payment due", percent: 100, trigger: "invoice_date", days: 7 }],
};

export function termsTotalPercent(terms: PaymentTerm[]): number {
  return terms.reduce((sum, t) => sum + t.percent, 0);
}

// Resolves a term's actual due date given the quote's lifecycle dates.
// Falls back to "now" for a trigger date that hasn't happened yet
// (e.g. completion terms before the job is marked complete) so a date
// always renders, even though it'll move once the real trigger fires.
export function resolveDueDate(
  term: PaymentTerm,
  dates: { acceptedAt?: string | null; completedAt?: string | null; createdAt: string }
): Date {
  const base =
    term.trigger === "acceptance"
      ? dates.acceptedAt ?? dates.createdAt
      : term.trigger === "completion"
        ? dates.completedAt ?? dates.acceptedAt ?? dates.createdAt
        : dates.createdAt;

  const due = new Date(base);
  due.setDate(due.getDate() + term.days);
  return due;
}

export function termAmount(term: PaymentTerm, totalCost: number): number {
  return Math.round((totalCost * term.percent) / 100);
}
