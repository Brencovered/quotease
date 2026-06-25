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
        .select("status, total_cost, amount_paid, created_at, follow_up_at, quote_expires_at, sent_at, labour_hours, materials_cost")
        .eq("profile_id", userData.user.id);
      if (quotes) stats = computeDashboardStats(quotes);
    }
  } catch (err) {
    console.error("Dashboard page:", err);
  }

  return (
    <>
      <AppHeader active="dashboard" />
      <DashboardPanel stats={stats} />
    </>
  );
}
