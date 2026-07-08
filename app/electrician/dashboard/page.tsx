import { createClient } from "@/lib/supabase/server";
import { computeDashboardStats, computeProfitStats } from "@/lib/dashboardStats";
import { getActiveBusinessId } from "@/lib/team";
import { getOnboardingProgress, type OnboardingProgress } from "@/lib/onboarding";
import AppHeader from "@/components/AppHeader";
import DashboardPanel from "@/components/DashboardPanel";
import TrialOnboardingWidget from "@/components/TrialOnboardingWidget";

export default async function DashboardPage() {
  let stats = computeDashboardStats([]);
  let profit = computeProfitStats([], [], 95);
  let onboardingProgress: OnboardingProgress | null = null;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      const [{ data: quotes }, { data: actuals }, { data: profile }] = await Promise.all([
        supabase
          .from("quotes")
          .select("id, status, total_cost, amount_paid, created_at, follow_up_at, quote_expires_at, sent_at, labour_hours, materials_cost")
          .eq("profile_id", businessId),
        supabase.from("job_actuals").select("quote_id, actual_hours, actual_materials_cost, unexpected_costs").eq("profile_id", businessId),
        supabase.from("profiles").select("hourly_rate").eq("id", businessId).single(),
      ]);
      if (quotes) {
        stats = computeDashboardStats(quotes);
        profit = computeProfitStats(quotes, actuals ?? [], profile?.hourly_rate ?? 95);
      }
      onboardingProgress = await getOnboardingProgress(supabase, businessId);
    }
  } catch (err) {
    console.error("Dashboard page:", err);
  }

  return (
    <>
      <AppHeader />
      <div className="page-wrap pt-4">
        {onboardingProgress && <TrialOnboardingWidget initialProgress={onboardingProgress} />}
      </div>
      <DashboardPanel stats={stats} profit={profit} />
    </>
  );
}
