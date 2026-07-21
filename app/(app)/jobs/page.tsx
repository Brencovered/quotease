import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import { getCachedBoardColumns } from "@/lib/cache";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let boardColumns: any[] = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);

      /* ── All queries in parallel ── */
      const [{ data: allJobs }, { data: quotesData }, { data: teamRows }, { data: docketRows }, columns] = await Promise.all([
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
        supabase.from("dockets").select("job_id, total_cost").eq("profile_id", businessId).eq("status", "signed"),
        getCachedBoardColumns(businessId),
      ]);

      // Sum of signed, unbilled docket totals per job - shown as a "ready
      // to invoice" badge on the board so it's visible where jobs are
      // actually managed day to day, not just on a separate dockets page.
      const readyToInvoiceByJob = new Map<string, number>();
      for (const d of docketRows ?? []) {
        readyToInvoiceByJob.set(d.job_id, (readyToInvoiceByJob.get(d.job_id) ?? 0) + (d.total_cost ?? 0));
      }

      if (allJobs) {
        const withReadyToInvoice = allJobs.map((j) => ({ ...j, ready_to_invoice: readyToInvoiceByJob.get(j.id) ?? 0 }));
        boardJobs = withReadyToInvoice.filter((j) => !j.is_recurring_template);
        quickJobs = withReadyToInvoice.filter((j) => j.source === "quick" || j.source === "recurring");
      }
      if (quotesData) listJobs = quotesData;
      if (teamRows) teamMembers = teamRows;
      boardColumns = columns;
    }
  } catch (err) {
    // Log a safe summary rather than the raw error object: some Supabase
    // auth failures throw/attach an object with a reference back to the
    // internal auth client itself (mfa -> webauthn -> client -> ...circular),
    // which crashes console.error's own serialization with "Converting
    // circular structure to JSON" instead of surfacing the real problem.
    console.error(
      "Jobs page: falling back to empty list -",
      err instanceof Error ? err.message : String(err)
    );
  }

  return (
    <>
      <AppHeader />
      <JobsPageClient boardJobs={boardJobs} quickJobs={quickJobs} listJobs={listJobs} teamMembers={teamMembers} boardColumns={boardColumns} />
    </>
  );
}
