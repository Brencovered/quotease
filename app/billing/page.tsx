import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BillingPanel from "@/components/BillingPanel";

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, subscription_plan, trial_ends_at, current_period_end")
    .eq("id", userData.user.id)
    .single();

  return <BillingPanel profile={profile ?? null} />;
}
