import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";
import { computeReportStats } from "@/lib/reportStats";
import { markOnboardingMilestone } from "@/lib/onboarding";
import AppHeader from "@/components/AppHeader";
import ReportsPanel from "@/components/ReportsPanel";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  let stats = computeReportStats([], [], [], []);
  let isAdmin = false;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const ctx = await getTeamContext(supabase, userData.user.id);
      isAdmin = ctx.isOwner || ctx.role === "admin";
      const businessId = ctx.businessId;

      const [{ data: jobs }, { data: payments }, { data: teamRows }, timesheetRows] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, job_number, status, total_cost, amount_paid, completed_at, assigned_to_member_id, is_recurring_template, archived_at, cancelled_at")
          .eq("profile_id", businessId),
        supabase.from("payments").select("amount, recorded_at").eq("profile_id", businessId),
        supabase.from("team_members").select("id, name, email").eq("owner_profile_id", businessId).eq("status", "active"),
        // Timesheets are admin-only (RLS) - a non-admin team member simply
        // won't see hours-logged data, which matches how the Timesheets
        // panel on the job detail page already gates this.
        isAdmin
          ? supabase.from("timesheets").select("team_member_id, member_name, hours, work_date").eq("profile_id", businessId).then((r) => r.data ?? [])
          : Promise.resolve([]),
      ]);

      stats = computeReportStats(jobs ?? [], payments ?? [], teamRows ?? [], timesheetRows ?? []);

      // Day 7 onboarding milestone -- fire-and-forget, never block the page.
      markOnboardingMilestone(supabase, businessId, "report_viewed_at").catch(() => {});
    }
  } catch (err) {
    console.error("Reports page:", err);
  }

  return (
    <>
      <AppHeader />
      <ReportsPanel stats={stats} isAdmin={isAdmin} />
    </>
  );
}
