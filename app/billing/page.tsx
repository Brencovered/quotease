import { createClient } from "@/lib/supabase/server";
import BillingPanel from "@/components/BillingPanel";
import AppHeader from "@/components/AppHeader";

export default async function BillingPage() {
  let profile = null;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data } = await supabase
        .from("profiles")
        .select("subscription_status, subscription_plan, trial_ends_at, current_period_end")
        .eq("id", userData.user.id)
        .single();
      profile = data;
    }
  } catch (err) {
    console.error("Billing page: showing plan picker without profile data —", err);
  }

  return (
    <>
      <AppHeader />
      <BillingPanel profile={profile} />
    </>
  );
}
