import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireActiveAccess() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return; // not logged in - let the page itself handle that

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at")
    .eq("id", userData.user.id)
    .single();

  if (!profile) return;

  const isSubscribed = profile.subscription_status === "active" || profile.subscription_status === "trialing";
  const trialStillActive = !!profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date();

  if (!isSubscribed && !trialStillActive) {
    redirect("/billing");
  }
}
