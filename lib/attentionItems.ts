// "What needs your attention today" - a single, consolidated list of things
// across quotes/jobs/invoices/timesheets that are stale enough to need a
// human to look at them, instead of a tradie having to check five separate
// tabs to find the same thing. Pure function, no data fetching - the caller
// passes in already-scoped (team-aware) rows.

export type AttentionItemType =
  | "quote_follow_up"
  | "quote_expired"
  | "job_stalled"
  | "invoice_overdue"
  | "timesheet_missing";

export interface AttentionItem {
  id: string; // stable key: `${type}:${entityId}`
  type: AttentionItemType;
  severity: "high" | "medium";
  label: string;
  sublabel: string;
  href: string;
}

export interface QuoteForAttention {
  id: string;
  client_name: string | null;
  status: string;
  follow_up_at?: string | null;
  quote_expires_at?: string | null;
}

export interface JobForAttention {
  id: string;
  client_name: string | null;
  status: string;
  updated_at: string;
  invoiced_at: string | null;
  completed_at: string | null;
  total_cost: number | null;
  amount_paid: number | null;
  assigned_to_member_id: string | null;
}

export interface TimesheetForAttention {
  job_id: string | null;
}

export interface TeamMemberForAttention {
  id: string;
  name: string | null;
  status: string;
}

const DAY_MS = 86400000;

function daysAgo(dateStr: string | null | undefined, now: number): number | null {
  if (!dateStr) return null;
  return Math.floor((now - new Date(dateStr).getTime()) / DAY_MS);
}

// Active (non-terminal) job statuses - the ones where "no activity in a
// while" actually signals something falling through the cracks, rather than
// a job that's simply done and sitting in an end state on purpose.
const STALLED_ELIGIBLE_STATUSES = new Set(["scheduled", "in_progress", "on_hold", "awaiting_sign_off"]);
const INVOICED_STATUSES = new Set(["invoiced", "partially_paid"]);
// Statuses a job passes through on the way to "done" - used to find jobs
// that finished recently but never got a timesheet logged against them.
const COMPLETED_LIKE_STATUSES = new Set(["complete", "invoiced", "partially_paid", "archived"]);

export function computeAttentionItems(
  data: {
    quotes: QuoteForAttention[];
    jobs: JobForAttention[];
    timesheets: TimesheetForAttention[];
    teamMembers: TeamMemberForAttention[];
  },
  opts: {
    stalledJobDays?: number;
    overdueInvoiceDays?: number;
    missingTimesheetDays?: number;
    now?: Date;
  } = {}
): AttentionItem[] {
  const { quotes, jobs, timesheets, teamMembers } = data;
  const stalledJobDays = opts.stalledJobDays ?? 7;
  const overdueInvoiceDays = opts.overdueInvoiceDays ?? 14;
  const missingTimesheetDays = opts.missingTimesheetDays ?? 14;
  const now = (opts.now ?? new Date()).getTime();

  const items: AttentionItem[] = [];

  // 1. Quotes sitting past their follow-up date with no client response yet.
  for (const q of quotes) {
    if (q.status !== "sent") continue;
    if (q.follow_up_at) {
      const d = daysAgo(q.follow_up_at, now);
      if (d !== null && d >= 0) {
        items.push({
          id: `quote_follow_up:${q.id}`,
          type: "quote_follow_up",
          severity: d > 3 ? "high" : "medium",
          label: `Follow up with ${q.client_name || "client"}`,
          sublabel: `Quote sent, follow-up was due ${d === 0 ? "today" : `${d} day${d !== 1 ? "s" : ""} ago`}`,
          href: `/electrician/quotes/${q.id}`,
        });
      }
    }
    if (q.quote_expires_at) {
      const d = daysAgo(q.quote_expires_at, now);
      if (d !== null && d >= 0) {
        items.push({
          id: `quote_expired:${q.id}`,
          type: "quote_expired",
          severity: "medium",
          label: `Quote for ${q.client_name || "client"} has expired`,
          sublabel: `Expired ${d === 0 ? "today" : `${d} day${d !== 1 ? "s" : ""} ago`} - resend or update the price`,
          href: `/electrician/quotes/${q.id}`,
        });
      }
    }
  }

  // 2. Jobs with no activity in a while - status hasn't moved and nothing's
  // been touched, which usually means it's been forgotten rather than
  // deliberately parked (on_hold is still eligible - "on hold" silently
  // becoming "on hold forever" is exactly the failure mode this catches).
  for (const j of jobs) {
    if (!STALLED_ELIGIBLE_STATUSES.has(j.status)) continue;
    const d = daysAgo(j.updated_at, now);
    if (d !== null && d >= stalledJobDays) {
      items.push({
        id: `job_stalled:${j.id}`,
        type: "job_stalled",
        severity: d > stalledJobDays * 2 ? "high" : "medium",
        label: `${j.client_name || "Job"} hasn't moved in ${d} days`,
        sublabel: `Status: ${j.status.replace(/_/g, " ")}`,
        href: `/electrician/jobs/${j.id}`,
      });
    }
  }

  // 3. Invoiced jobs that are still unpaid past a reasonable payment window.
  for (const j of jobs) {
    if (!INVOICED_STATUSES.has(j.status)) continue;
    if (!j.invoiced_at) continue;
    const outstanding = (j.total_cost ?? 0) - (j.amount_paid ?? 0);
    if (outstanding <= 0) continue;
    const d = daysAgo(j.invoiced_at, now);
    if (d !== null && d >= overdueInvoiceDays) {
      items.push({
        id: `invoice_overdue:${j.id}`,
        type: "invoice_overdue",
        severity: d > overdueInvoiceDays * 2 ? "high" : "medium",
        label: `${j.client_name || "Invoice"} unpaid for ${d} days`,
        sublabel: `$${outstanding.toLocaleString()} outstanding`,
        href: `/electrician/jobs/${j.id}`,
      });
    }
  }

  // 4. Jobs that finished recently but have no timesheet logged against them
  // at all - the actuals/margin picture for that job is silently incomplete.
  const jobIdsWithTimesheets = new Set(timesheets.map((t) => t.job_id).filter(Boolean));
  const activeMemberIds = new Set(teamMembers.filter((m) => m.status === "active").map((m) => m.id));
  for (const j of jobs) {
    if (!COMPLETED_LIKE_STATUSES.has(j.status)) continue;
    if (!j.assigned_to_member_id || !activeMemberIds.has(j.assigned_to_member_id)) continue;
    if (jobIdsWithTimesheets.has(j.id)) continue;
    const completedRef = j.completed_at ?? j.updated_at;
    const d = daysAgo(completedRef, now);
    if (d !== null && d >= 0 && d <= missingTimesheetDays) {
      items.push({
        id: `timesheet_missing:${j.id}`,
        type: "timesheet_missing",
        severity: "medium",
        label: `No hours logged for ${j.client_name || "a completed job"}`,
        sublabel: `Completed ${d === 0 ? "today" : `${d} day${d !== 1 ? "s" : ""} ago`} - margin data is incomplete without it`,
        href: `/electrician/jobs/${j.id}`,
      });
    }
  }

  // Highest severity first, then most overdue-sounding types before informational ones.
  const typeOrder: Record<AttentionItemType, number> = {
    invoice_overdue: 0,
    quote_follow_up: 1,
    job_stalled: 2,
    quote_expired: 3,
    timesheet_missing: 4,
  };
  items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
    return typeOrder[a.type] - typeOrder[b.type];
  });

  return items;
}
