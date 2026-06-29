import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import CalendarPanel from "@/components/CalendarPanel";

export default async function SchedulePage() {
  let jobs: Array<Record<string, unknown>> = [];
  let manualEvents: Array<Record<string, unknown>> = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      // Fetch accepted/paid jobs (schedulable) + sent quotes (for follow-up/expiry events)
      const [{ data }, { data: events }] = await Promise.all([
        supabase
          .from("quotes")
          .select("id, client_name, site_address, total_cost, job_type, status, scheduled_start, scheduled_end, estimated_days, follow_up_at, quote_expires_at, sent_at")
          .eq("profile_id", businessId)
          .in("status", ["accepted", "paid", "sent"])
          .order("scheduled_start", { ascending: true, nullsFirst: false }),
        supabase
          .from("schedule_events")
          .select("id, title, notes, start_at, end_at, all_day")
          .eq("profile_id", businessId)
          .order("start_at"),
      ]);
      if (data) jobs = data;
      if (events) manualEvents = events;
    }
  } catch (err) {
    console.error("Schedule page error:", err);
  }

  return (
    <>
      <AppHeader />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <CalendarPanel jobs={jobs as any} manualEvents={manualEvents as any} />
    </>
  );
}
