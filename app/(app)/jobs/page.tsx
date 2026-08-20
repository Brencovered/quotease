import { createClient } from "@/lib/supabase/server";
import { getTeamContext, isFieldWorker } from "@/lib/team";
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
      const ctx = await getTeamContext(supabase, userData.user.id);
      const businessId = ctx.businessId;
      const fieldOnly = isFieldWorker(ctx);

      const [
        { data: allJobs },
        { data: quotesData },
        { data: teamRows },
        { data: docketRows },
        columns,
        { data: membership },
        { data: crewRows },
      ] = await Promise.all([
        supabase
          .from("jobs")
          .select(
            "id, job_number, client_name, site_address, total_cost, amount_paid, status, source, scheduled_date, scheduled_start, is_recurring_template, recurrence_rule, assigned_to_member_id"
          )
          .eq("profile_id", businessId)
          .order("created_at", { ascending: false }),
        fieldOnly
          ? Promise.resolve({ data: [] as unknown[] })
          : supabase
              .from("quotes")
              .select("*")
              .eq("profile_id", businessId)
              .eq("status", "accepted")
              .order("accepted_at", { ascending: true }),
        fieldOnly
          ? Promise.resolve({
              data: [] as Array<{ id: string; name: string | null; email: string }>,
            })
          : supabase
              .from("team_members")
              .select("id, name, email")
              .eq("owner_profile_id", businessId)
              .eq("status", "active")
              .order("name"),
        fieldOnly
          ? Promise.resolve({
              data: [] as Array<{ job_id: string; total_cost: number | null }>,
            })
          : supabase
              .from("dockets")
              .select("job_id, total_cost")
              .eq("profile_id", businessId)
              .eq("status", "signed"),
        fieldOnly ? Promise.resolve([]) : getCachedBoardColumns(businessId),
        supabase
          .from("team_members")
          .select("id")
          .eq("member_user_id", userData.user.id)
          .eq("status", "active")
          .maybeSingle(),
        fieldOnly
          ? supabase
              .from("job_crew")
              .select("job_id, team_member_id")
              .eq("profile_id", businessId)
          : Promise.resolve({
              data: [] as Array<{ job_id: string; team_member_id: string }>,
            }),
      ]);

      const readyToInvoiceByJob = new Map<string, number>();
      for (const d of docketRows ?? []) {
        readyToInvoiceByJob.set(
          d.job_id,
          (readyToInvoiceByJob.get(d.job_id) ?? 0) + (d.total_cost ?? 0)
        );
      }

      const myMemberId = membership?.id ?? null;
      const myCrewJobIds = new Set(
        (crewRows ?? [])
          .filter((r) => r.team_member_id === myMemberId)
          .map((r) => r.job_id)
      );

      if (allJobs) {
        let scoped = allJobs;
        if (fieldOnly && myMemberId) {
          scoped = allJobs.filter(
            (j) =>
              j.assigned_to_member_id === myMemberId || myCrewJobIds.has(j.id)
          );
        }
        const withReadyToInvoice = scoped.map((j) => ({
          ...j,
          total_cost: fieldOnly ? null : j.total_cost,
          amount_paid: fieldOnly ? null : j.amount_paid,
          ready_to_invoice: fieldOnly ? 0 : readyToInvoiceByJob.get(j.id) ?? 0,
        }));
        boardJobs = withReadyToInvoice.filter((j) => !j.is_recurring_template);
        quickJobs = withReadyToInvoice.filter(
          (j) => j.source === "quick" || j.source === "recurring"
        );
      }
      if (quotesData) listJobs = quotesData as typeof listJobs;
      if (teamRows) teamMembers = teamRows;
      boardColumns = columns;
    }
  } catch (err) {
    console.error(
      "Jobs page: falling back to empty list -",
      err instanceof Error ? err.message : String(err)
    );
  }

  return (
    <>
      <AppHeader />
      <JobsPageClient
        boardJobs={boardJobs}
        quickJobs={quickJobs}
        listJobs={listJobs}
        teamMembers={teamMembers}
        boardColumns={boardColumns}
      />
    </>
  );
}
