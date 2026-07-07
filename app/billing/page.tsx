import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import BillingPanel from "@/components/BillingPanel";
import { getActiveBusinessId } from "@/lib/team";

export default async function BillingPage() {
  let trialEndsAt: string | null = null;
  let isSubscribed = false;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_status, trial_ends_at, comp_access")
        .eq("id", businessId)
        .single();
      trialEndsAt = profile?.trial_ends_at ?? null;
      // Comp access renders the same as an active subscription -- a tradie
      // you've comped shouldn't be nagged to subscribe.
      isSubscribed =
        profile?.comp_access === true ||
        profile?.subscription_status === "active" ||
        profile?.subscription_status === "trialing";
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
