import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

export async function requireActiveAccess() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return; // not logged in - let the page itself handle that

  // Subscriptions are per-business, not per-person. A team member's own
  // individual profile has no real subscription of its own - checking it
  // directly meant any team member whose personal trial window had
  // expired (every signup gets a short trial on their own stub profile)
  // was locked out of the entire app and redirected to /billing, even
  // though the business they work for has a perfectly valid subscription.
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at, comp_access")
    .eq("id", businessId)
    .single();

  if (!profile) return;

  // Admin-granted complimentary access bypasses billing entirely
  if (profile.comp_access) return;

  const isSubscribed = profile.subscription_status === "active" || profile.subscription_status === "trialing";
  const trialStillActive = !!profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date();

  if (!isSubscribed && !trialStillActive) {
    redirect("/billing");
  }
}
