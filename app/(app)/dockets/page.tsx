import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import DocketsOverviewClient, { type DocketRow } from "@/components/DocketsOverviewClient";

export default async function DocketsOverviewPage() {
  let signed: DocketRow[] = [];
  let awaiting: DocketRow[] = [];
  let recentlyInvoiced: DocketRow[] = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      const { data: rows } = await supabase
        .from("dockets")
        .select(
          "id, job_id, work_date, status, total_cost, client_name, signed_by_name, jobs(job_number, title, client_name), docket_invoices(invoice_number, status, xero_exported_at)"
        )
        .eq("profile_id", businessId)
        .order("work_date", { ascending: false })
        .limit(200);

      const all = (rows ?? []) as unknown as DocketRow[];
      signed = all.filter((r) => r.status === "signed");
      awaiting = all.filter((r) => r.status === "draft" || r.status === "sent");
      recentlyInvoiced = all.filter((r) => r.status === "invoiced").slice(0, 10);
    }
  } catch (err) {
    console.error("Dockets overview page:", err);
  }

  return (
    <>
      <AppHeader />
      <div className="page-wrap">
        <h1 className="font-display text-[26px] text-[var(--ink)] mb-1">Dockets</h1>
        <p className="text-[13px] text-[var(--ink-faint)] mb-6">Every dayworks docket across your jobs, in one place.</p>
        <DocketsOverviewClient signed={signed} awaiting={awaiting} recentlyInvoiced={recentlyInvoiced} />
      </div>
    </>
  );
}
