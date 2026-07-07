import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ExportPanel from "@/components/ExportPanel";
import { getActiveBusinessId } from "@/lib/team";

export default async function ExportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const businessId = await getActiveBusinessId(supabase, user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, abn, hourly_rate")
    .eq("id", businessId)
    .single();

  // Fetch all accepted/paid quotes with job actuals and variations
  const { data: quotes } = await supabase
    .from("quotes")
    .select(`
      id, client_name, client_email, site_address, trade, job_type,
      total_cost, labour_hours, materials_cost, markup_materials,
      amount_paid, status, invoice_number, xero_exported_at,
      sent_at, accepted_at, completed_at, paid_at, created_at,
      scheduled_date
    `)
    .eq("profile_id", businessId)
    .in("status", ["accepted", "paid"])
    .order("created_at", { ascending: false });

  // Get variations for each quote
  const quoteIds = (quotes ?? []).map(q => q.id);
  const { data: variations } = quoteIds.length > 0
    ? await supabase
        .from("variations")
        .select("quote_id, description, total_cost, status")
        .in("quote_id", quoteIds)
        .eq("status", "approved")
    : { data: [] };

  // Get job actuals
  const { data: actuals } = quoteIds.length > 0
    ? await supabase
        .from("job_actuals")
        .select("quote_id, actual_hours, actual_materials_cost")
        .in("quote_id", quoteIds)
    : { data: [] };

  return (
    <>
      <AppHeader />
      <div className="page-wrap-narrow">
        <div className="mb-6">
          <h1 className="font-display text-[26px] text-[var(--ink)]">Export to Xero / MYOB</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
            Download a CSV of your completed jobs to import directly into Xero or MYOB.
          </p>
        </div>
        <ExportPanel
          quotes={quotes ?? []}
          variations={variations ?? []}
          actuals={actuals ?? []}
          businessName={profile?.business_name ?? ""}
          abn={profile?.abn ?? ""}
        />
      </div>
    </>
  );
}
