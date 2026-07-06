import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import JobsPageClient from "./JobsPageClient";

export default async function JobsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let boardJobs: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let quickJobs: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listJobs: any[] = [];
  let teamMembers: Array<{ id: string; name: string | null; email: string }> = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      const [{ data: allJobs }, { data: quotesData }, { data: teamRows }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, job_number, client_name, site_address, total_cost, amount_paid, status, source, scheduled_date, scheduled_start, is_recurring_template, recurrence_rule")
          .eq("profile_id", businessId)
          .order("created_at", { ascending: false }),
        supabase
          .from("quotes")
          .select("*")
          .eq("profile_id", businessId)
          .eq("status", "accepted")
          .order("accepted_at", { ascending: true }),
        supabase.from("team_members").select("id, name, email").eq("owner_profile_id", businessId).eq("status", "active").order("name"),
      ]);
      if (allJobs) {
        boardJobs = allJobs.filter((j) => !j.is_recurring_template);
        quickJobs = allJobs.filter((j) => j.source === "quick" || j.source === "recurring");
      }
      if (quotesData) listJobs = quotesData;
      if (teamRows) teamMembers = teamRows;
    }
  } catch (err) {
    console.error("Jobs page: falling back to empty list -", err);
  }

  return (
    <>
      <AppHeader />
      <JobsPageClient boardJobs={boardJobs} quickJobs={quickJobs} listJobs={listJobs} teamMembers={teamMembers} />
    </>
  );
}
