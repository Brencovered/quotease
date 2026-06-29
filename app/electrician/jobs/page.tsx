import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import JobsPanel from "@/components/JobsPanel";
import AppHeader from "@/components/AppHeader";

export default async function JobsPage() {
  let jobs: Array<Record<string, unknown>> = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      const { data } = await supabase
        .from("quotes")
        .select("*")
        .eq("profile_id", businessId)
        .eq("status", "accepted")
        .order("accepted_at", { ascending: true });
      if (data) {
        const ids = data.map((q) => q.id);
        const { data: tasks } = ids.length
          ? await supabase.from("job_tasks").select("quote_id, status").in("quote_id", ids)
          : { data: [] as { quote_id: string; status: string }[] };
        const taskCounts = new Map<string, { total: number; done: number }>();
        for (const t of tasks ?? []) {
          const c = taskCounts.get(t.quote_id) ?? { total: 0, done: 0 };
          c.total += 1;
          if (t.status === "done") c.done += 1;
          taskCounts.set(t.quote_id, c);
        }
        jobs = data.map((q) => ({ ...q, taskCounts: taskCounts.get(q.id) ?? null }));
      }
    }
  } catch (err) {
    console.error("Jobs page: falling back to empty list -", err);
  }

  return (
    <>
      <AppHeader />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <JobsPanel jobs={jobs as any} />
    </>
  );
}
