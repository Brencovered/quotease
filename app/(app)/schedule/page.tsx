import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import CalendarPanel from "@/components/CalendarPanel";


// Signed-in page: reads cookies to resolve the current user, so it can
// never be statically prerendered. Declaring that here stops Next
// attempting a static render at build time, which previously threw
// DYNAMIC_SERVER_USAGE into the build log on every deploy and made real
// build failures much harder to spot.
export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  let jobs: Array<Record<string, unknown>> = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      // Fetch accepted/paid jobs (schedulable) + sent quotes (for follow-up/expiry events)
      const { data } = await supabase
        .from("quotes")
        .select("id, client_name, site_address, total_cost, job_type, status, scheduled_start, scheduled_end, estimated_days, follow_up_at, quote_expires_at, sent_at, jobs(job_number)")
        .eq("profile_id", businessId)
        .in("status", ["accepted", "paid", "sent"])
        .order("scheduled_start", { ascending: true, nullsFirst: false });
      if (data) jobs = data;
    }
  } catch (err) {
    console.error("Schedule page error:", err);
  }

  return (
    <>
      <AppHeader />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <CalendarPanel jobs={jobs as any} />
    </>
  );
}
