import { createClient } from "@/lib/supabase/server";
import JobsPanel from "@/components/JobsPanel";
import AppHeader from "@/components/AppHeader";

export default async function JobsPage() {
  let jobs: Array<Record<string, unknown>> = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data } = await supabase
        .from("quotes")
        .select("*")
        .eq("profile_id", userData.user.id)
        .eq("status", "accepted")
        .order("accepted_at", { ascending: true });
      if (data) jobs = data;
    }
  } catch (err) {
    console.error("Jobs page: falling back to empty list —", err);
  }

  return (
    <>
      <AppHeader />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <JobsPanel jobs={jobs as any} />
    </>
  );
}
