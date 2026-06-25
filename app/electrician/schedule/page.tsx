import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import CalendarPanel from "@/components/CalendarPanel";

export default async function SchedulePage() {
  let jobs: Array<Record<string, unknown>> = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data } = await supabase
        .from("quotes")
        .select("id, client_name, site_address, total_cost, job_type, status, scheduled_start, scheduled_end, estimated_days")
        .eq("profile_id", userData.user.id)
        .in("status", ["accepted", "paid"])
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
