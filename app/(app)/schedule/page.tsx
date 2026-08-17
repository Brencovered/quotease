import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import CalendarPanel from "@/components/CalendarPanel";
import { resolveScheduledStart } from "@/lib/scheduleNormalize";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  let jobs: Array<Record<string, unknown>> = [];
  let followUps: Array<Record<string, unknown>> = [];
  let teamMembers: Array<{ id: string; name: string | null; email: string }> = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);

      const [{ data: jobRows }, { data: sentQuotes }, { data: members }, { data: crewRows }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, quote_id, client_name, site_address, total_cost, title, trade, status, job_number, scheduled_date, scheduled_start, scheduled_end, estimated_days, assigned_to_member_id")
          .eq("profile_id", businessId)
          .not("status", "in", '("cancelled","archived")')
          .order("scheduled_start", { ascending: true, nullsFirst: false }),
        supabase
          .from("quotes")
          .select("id, client_name, site_address, status, follow_up_at, quote_expires_at, sent_at")
          .eq("profile_id", businessId)
          .eq("status", "sent"),
        supabase
          .from("team_members")
          .select("id, name, email")
          .eq("owner_profile_id", businessId)
          .eq("status", "active"),
        supabase
          .from("job_crew")
          .select("job_id, team_member_id")
          .eq("profile_id", businessId),
      ]);

      const crewByJob = new Map<string, string[]>();
      for (const row of crewRows ?? []) {
        const list = crewByJob.get(row.job_id) ?? [];
        list.push(row.team_member_id);
        crewByJob.set(row.job_id, list);
      }

      jobs = (jobRows ?? []).map((j) => {
        const start = resolveScheduledStart(j.scheduled_start, j.scheduled_date);
        const crew = crewByJob.get(j.id) ?? [];
        if (j.assigned_to_member_id && !crew.includes(j.assigned_to_member_id)) {
          crew.unshift(j.assigned_to_member_id);
        }
        return {
          ...j,
          job_type: j.title ?? j.trade,
          scheduled_start: start,
          crew_member_ids: crew,
        };
      });

      followUps = sentQuotes ?? [];
      teamMembers = members ?? [];
    }
  } catch (err) {
    console.error("Schedule page error:", err);
  }

  return (
    <>
      <AppHeader />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <CalendarPanel jobs={jobs as any} followUps={followUps as any} teamMembers={teamMembers} />
    </>
  );
}
