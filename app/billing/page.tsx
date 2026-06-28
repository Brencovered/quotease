import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import BillingPanel from "@/components/BillingPanel";

export default async function BillingPage() {
  let trialEndsAt: string | null = null;
  let isSubscribed = false;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_status, trial_ends_at")
        .eq("id", userData.user.id)
        .single();
      trialEndsAt = profile?.trial_ends_at ?? null;
      isSubscribed = profile?.subscription_status === "active" || profile?.subscription_status === "trialing";
    }
  } catch (err) {
    console.error("Billing page: continuing without profile data -", err);
  }

  return (
    <>
      <AppHeader />
      <BillingPanel trialEndsAt={trialEndsAt} isSubscribed={isSubscribed} />
    </>
  );
}
