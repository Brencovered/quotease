import { createClient } from "@/lib/supabase/server";
import { computeDashboardStats, computeProfitStats } from "@/lib/dashboardStats";
import { computeAttentionItems, type AttentionItem } from "@/lib/attentionItems";
import { getActiveBusinessId } from "@/lib/team";
import { getOnboardingProgress, type OnboardingProgress } from "@/lib/onboarding";
import AppHeader from "@/components/AppHeader";
import DashboardPanel from "@/components/DashboardPanel";
import AttentionCard from "@/components/AttentionCard";
import TrialOnboardingWidget from "@/components/TrialOnboardingWidget";

export default async function DashboardPage() {
  let stats = computeDashboardStats([]);
  let profit = computeProfitStats([], [], 95);
  let onboardingProgress: OnboardingProgress | null = null;
  let attentionItems: AttentionItem[] = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      const [
        { data: quotes },
        { data: actuals },
        { data: profile },
        { data: jobs },
        { data: timesheets },
        { data: teamMembers },
        onboarding,
      ] = await Promise.all([
        supabase
          .from("quotes")
          .select("id, client_name, status, total_cost, amount_paid, created_at, follow_up_at, quote_expires_at, sent_at, labour_hours, materials_cost")
          .eq("profile_id", businessId),
        supabase.from("job_actuals").select("quote_id, actual_hours, actual_materials_cost, unexpected_costs").eq("profile_id", businessId),
        supabase.from("profiles").select("hourly_rate").eq("id", businessId).single(),
        supabase
          .from("jobs")
          .select("id, client_name, status, updated_at, invoiced_at, completed_at, total_cost, amount_paid, assigned_to_member_id")
          .eq("profile_id", businessId),
        supabase.from("timesheets").select("job_id").eq("profile_id", businessId),
        supabase.from("team_members").select("id, name, status").eq("owner_profile_id", businessId),
        // Previously awaited separately *after* the six queries above -
        // an independent 12-query batch (see lib/onboarding.ts) that only
        // needs businessId, so there was no real reason for it to wait.
        // Running it in the same Promise.all halves this page's total
        // server-side wait time (two round-trip batches -> one).
        getOnboardingProgress(supabase, businessId),
      ]);
      onboardingProgress = onboarding;
      if (quotes) {
        stats = computeDashboardStats(quotes);
        profit = computeProfitStats(quotes, actuals ?? [], profile?.hourly_rate ?? 95);
      }
      attentionItems = computeAttentionItems({
        quotes: quotes ?? [],
        jobs: jobs ?? [],
        timesheets: timesheets ?? [],
        teamMembers: teamMembers ?? [],
      });
    }
  } catch (err) {
    console.error("Dashboard page:", err);
  }

  return (
    <>
      <AppHeader />
      <div className="page-wrap pt-4">
        {onboardingProgress && <TrialOnboardingWidget initialProgress={onboardingProgress} />}
        <AttentionCard items={attentionItems} />
      </div>
      <DashboardPanel stats={stats} profit={profit} />
    </>
  );
}
