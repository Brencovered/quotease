/**
 * lib/reportStats.ts
 * -------------------
 * Powers the /electrician/reports dashboard. This is job-based (the real
 * jobs table), unlike lib/dashboardStats.ts which is quote-funnel-based
 * (win rate, pipeline by quote status) - the two are complementary, not
 * duplicates. This answers "what actually happened with the business
 * this month" rather than "how's the sales pipeline looking".
 */

export interface ReportJob {
  id: string;
  job_number: number;
  status: string;
  total_cost: number | null;
  amount_paid: number | null;
  completed_at: string | null;
  assigned_to_member_id: string | null;
  is_recurring_template: boolean;
  archived_at: string | null;
  cancelled_at: string | null;
}

export interface ReportPayment {
  amount: number;
  recorded_at: string;
}

export interface ReportTeamMember {
  id: string;
  name: string | null;
  email: string;
}

export interface ReportTimesheetEntry {
  team_member_id: string | null;
  member_name: string | null;
  hours: number | null;
  work_date: string;
}

export interface TeamProductivityRow {
  memberId: string | null;
  name: string;
  jobsCompleted: number;
  hoursLogged: number;
  revenue: number;
}

export interface ReportStats {
  revenueThisMonth: number;
  revenueLastMonth: number;
  jobsCompletedThisMonth: number;
  jobsCompletedAllTime: number;
  avgJobValue: number | null;
  totalActiveJobs: number;
  teamProductivity: TeamProductivityRow[];
}

function isSameMonth(dateStr: string, ref: Date): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

// "Real" jobs only - excludes recurring templates (which aren't jobs
// themselves, just the pattern that spawns them) and archived/cancelled
// jobs (which shouldn't count toward completed/revenue stats).
function isCountableJob(job: ReportJob): boolean {
  return !job.is_recurring_template && !job.archived_at && !job.cancelled_at;
}

const COMPLETED_STATUSES = new Set(["complete", "invoiced", "partially_paid"]);

export function computeReportStats(
  jobs: ReportJob[],
  payments: ReportPayment[],
  teamMembers: ReportTeamMember[],
  timesheets: ReportTimesheetEntry[]
): ReportStats {
  const now = new Date();
  const lastMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const revenueThisMonth = payments
    .filter((p) => isSameMonth(p.recorded_at, now))
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const revenueLastMonth = payments
    .filter((p) => isSameMonth(p.recorded_at, lastMonthRef))
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);

  const countableJobs = jobs.filter(isCountableJob);
  const completedJobs = countableJobs.filter((j) => j.completed_at && COMPLETED_STATUSES.has(j.status));

  const jobsCompletedThisMonth = completedJobs.filter((j) => isSameMonth(j.completed_at!, now)).length;
  const jobsCompletedAllTime = completedJobs.length;

  const totalCompletedValue = completedJobs.reduce((sum, j) => sum + (j.total_cost ?? 0), 0);
  const avgJobValue = completedJobs.length > 0 ? Math.round(totalCompletedValue / completedJobs.length) : null;

  const totalActiveJobs = countableJobs.filter((j) => !COMPLETED_STATUSES.has(j.status)).length;

  // Team productivity: one row per active team member, plus an
  // "Unassigned" row for jobs/hours that don't have a member attached -
  // rather than silently dropping that work from the totals.
  const memberById = new Map(teamMembers.map((m) => [m.id, m.name || m.email]));
  const rows = new Map<string, TeamProductivityRow>();

  function rowFor(memberId: string | null): TeamProductivityRow {
    const key = memberId ?? "unassigned";
    let row = rows.get(key);
    if (!row) {
      row = { memberId, name: memberId ? (memberById.get(memberId) ?? "Former team member") : "Unassigned", jobsCompleted: 0, hoursLogged: 0, revenue: 0 };
      rows.set(key, row);
    }
    return row;
  }

  for (const job of completedJobs) {
    const row = rowFor(job.assigned_to_member_id);
    row.jobsCompleted += 1;
    row.revenue += job.total_cost ?? 0;
  }
  for (const entry of timesheets) {
    const row = rowFor(entry.team_member_id);
    row.hoursLogged += entry.hours ?? 0;
  }

  // Always show active team members even if they have no completed jobs
  // or hours yet this period, so the list doesn't look incomplete.
  for (const member of teamMembers) rowFor(member.id);

  const teamProductivity = Array.from(rows.values())
    .filter((r) => r.memberId !== null || r.jobsCompleted > 0 || r.hoursLogged > 0)
    .sort((a, b) => b.revenue - a.revenue || b.jobsCompleted - a.jobsCompleted);

  return {
    revenueThisMonth,
    revenueLastMonth,
    jobsCompletedThisMonth,
    jobsCompletedAllTime,
    avgJobValue,
    totalActiveJobs,
    teamProductivity,
  };
}
