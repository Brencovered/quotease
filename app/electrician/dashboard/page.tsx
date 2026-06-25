import { createClient } from "@/lib/supabase/server";
import { computeDashboardStats, computeProfitStats } from "@/lib/dashboardStats";
import AppHeader from "@/components/AppHeader";
import DashboardPanel from "@/components/DashboardPanel";

export default async function DashboardPage() {
  let stats = computeDashboardStats([]);
  let profit = computeProfitStats([], [], 95);

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const [{ data: quotes }, { data: actuals }, { data: profile }] = await Promise.all([
        supabase
          .from("quotes")
          .select("id, status, total_cost, amount_paid, created_at, follow_up_at, quote_expires_at, sent_at, labour_hours, materials_cost")
          .eq("profile_id", userData.user.id),
        supabase.from("job_actuals").select("quote_id, actual_hours, actual_materials_cost").eq("profile_id", userData.user.id),
        supabase.from("profiles").select("hourly_rate").eq("id", userData.user.id).single(),
      ]);
      if (quotes) {
        stats = computeDashboardStats(quotes);
        profit = computeProfitStats(quotes, actuals ?? [], profile?.hourly_rate ?? 95);
      }
    }
  } catch (err) {
    console.error("Dashboard page:", err);
  }

  return (
    <>
      <AppHeader />
      <DashboardPanel stats={stats} profit={profit} />
    </>
  );
}
