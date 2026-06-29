import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import MarginDashboardPanel from "@/components/MarginDashboardPanel";

export default async function MarginsPage() {
  let rows: Array<{
    id: string; client_name: string | null; trade: string | null;
    total_cost: number; quotedHours: number; actualHours: number; actualMaterials: number; unexpectedCosts: number;
  }> = [];
  let hourlyRate = 95;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      const { data: profile } = await supabase.from("profiles").select("hourly_rate").eq("id", businessId).single();
      hourlyRate = profile?.hourly_rate ?? 95;

      const { data: jobs } = await supabase
        .from("quotes")
        .select("id, client_name, trade, total_cost, labour_hours")
        .eq("profile_id", businessId)
        .in("status", ["accepted", "paid"]);

      if (jobs && jobs.length > 0) {
        const { data: actuals } = await supabase
          .from("job_actuals")
          .select("quote_id, actual_hours, actual_materials_cost, unexpected_costs")
          .in("quote_id", jobs.map((j) => j.id));

        rows = jobs.map((j) => {
          const jobActuals = (actuals ?? []).filter((a) => a.quote_id === j.id);
          return {
            id: j.id,
            client_name: j.client_name,
            trade: j.trade,
            total_cost: j.total_cost ?? 0,
            quotedHours: j.labour_hours ?? 0,
            actualHours: jobActuals.reduce((s, a) => s + (a.actual_hours ?? 0), 0),
            actualMaterials: jobActuals.reduce((s, a) => s + (a.actual_materials_cost ?? 0), 0),
            unexpectedCosts: jobActuals.reduce((s, a) => s + (a.unexpected_costs ?? 0), 0),
          };
        });
      }
    }
  } catch (err) {
    console.error("Margins page: continuing with empty data -", err);
  }

  return (
    <>
      <AppHeader />
      <MarginDashboardPanel rows={rows} hourlyRate={hourlyRate} />
    </>
  );
}
