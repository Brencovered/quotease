/**
 * lib/deleteAccount.ts
 * --------------------
 * Shared logic for permanently deleting a tradie account, used by both
 * the self-service /api/account/delete route and the admin-only
 * /api/admin/delete-account route.
 *
 * This is destructive and irreversible: profiles.id cascades (see the
 * foreign keys in supabase/migrations.sql) to quotes, clients, price book
 * items, job attachments, payments, and everything else tied to the
 * account. There's no soft-delete/undo here -- callers are expected to
 * have already confirmed this with the person (see the confirmation UX in
 * AccountDangerZone.tsx and AdminTradieDetailPanel.tsx).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export async function deleteAccount(profileId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_subscription_id, ai_addon_subscription_id")
    .eq("id", profileId)
    .maybeSingle();

  // Cancel any live Stripe subscriptions immediately -- an account that no
  // longer exists here should not keep billing the tradie's card.
  if (profile?.stripe_subscription_id || profile?.ai_addon_subscription_id) {
    const stripe = getStripe();
    for (const subId of [profile.stripe_subscription_id, profile.ai_addon_subscription_id]) {
      if (!subId) continue;
      try {
        await stripe.subscriptions.cancel(subId);
      } catch {
        // Already canceled/doesn't exist on Stripe's side -- fine, keep going.
      }
    }
  }

  // team_members.member_user_id has no FK/cascade (it can point to a user
  // under a *different* owner's business), so if this account was a team
  // member elsewhere that row needs cleaning up explicitly or it's left
  // pointing at a deleted user.
  await admin.from("team_members").delete().eq("member_user_id", profileId);

  // Deletes the profile row -- cascades to quotes, clients, price book
  // items, job attachments, team_members (as owner), etc.
  const { error: profileError } = await admin.from("profiles").delete().eq("id", profileId);
  if (profileError) return { error: profileError.message };

  // Finally remove the auth user so they can no longer log in. profiles.id
  // and auth.users.id are the same value by convention but there's no
  // formal FK between them, so this has to happen as a separate step.
  const { error: authError } = await admin.auth.admin.deleteUser(profileId);
  if (authError) return { error: `Profile deleted, but removing the login failed: ${authError.message}` };

  return {};
}
