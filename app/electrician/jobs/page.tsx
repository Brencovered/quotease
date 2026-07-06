import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import JobsPanel from "@/components/JobsPanel";
import QuickJobsPanel from "@/components/QuickJobsPanel";
import AppHeader from "@/components/AppHeader";

export default async function JobsPage() {
  let jobs: Array<Record<string, unknown>> = [];
  let quickJobs: Array<Record<string, unknown>> = [];
  let teamMembers: Array<{ id: string; name: string | null; email: string }> = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      const [{ data }, { data: quickData }, { data: teamRows }] = await Promise.all([
        supabase
          .from("quotes")
          .select("*")
          .eq("profile_id", businessId)
          .eq("status", "accepted")
          .order("accepted_at", { ascending: true }),
        supabase
          .from("jobs")
          .select("*")
          .eq("profile_id", businessId)
          .in("source", ["quick", "recurring"])
          .order("created_at", { ascending: false }),
        supabase.from("team_members").select("id, name, email").eq("owner_profile_id", businessId).eq("status", "active").order("name"),
      ]);
      if (data) jobs = data;
      if (quickData) quickJobs = quickData;
      if (teamRows) teamMembers = teamRows;
    }
  } catch (err) {
    console.error("Jobs page: falling back to empty list -", err);
  }

  return (
    <>
      <AppHeader />
      <div className="page-wrap">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <QuickJobsPanel jobs={quickJobs as any} teamMembers={teamMembers} />
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <JobsPanel jobs={jobs as any} />
    </>
  );
}
