import { createClient } from "@/lib/supabase/server";
import { computeDashboardStats } from "@/lib/dashboardStats";
import AppHeader from "@/components/AppHeader";
import DashboardPanel from "@/components/DashboardPanel";

export default async function DashboardPage() {
  let stats = computeDashboardStats([]);

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: quotes } = await supabase
        .from("quotes")
        .select("status, total_cost, amount_paid, created_at")
        .eq("profile_id", userData.user.id);
      if (quotes) stats = computeDashboardStats(quotes);
    }
  } catch (err) {
    console.error("Dashboard page: showing empty stats —", err);
  }

  return (
    <>
      <AppHeader active="dashboard" />
      <DashboardPanel stats={stats} />
    </>
  );
}
