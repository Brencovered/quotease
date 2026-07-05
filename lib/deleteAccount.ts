/**
 * lib/deleteAccount.ts
 * --------------------
 * Account deletion is a 30-day soft-delete, not an instant wipe:
 *
 *   softDeleteAccount  -- cancels billing immediately, marks the account
 *                          deleted_at = now(), signs them out. The account
 *                          and everything in it (quotes, clients, price
 *                          book) still exists, untouched, in the database.
 *   restoreAccount     -- clears deleted_at. Available any time before the
 *                          purge job runs (i.e. within the 30-day window).
 *                          Does NOT restore a canceled subscription -- the
 *                          tradie needs to resubscribe if it lapsed.
 *   purgeAccount       -- the real, irreversible deletion. Only ever
 *                          called by the daily cron job (30+ days after
 *                          deleted_at) or an explicit admin "delete now"
 *                          override. Cascades to quotes, clients, price
 *                          book items, job attachments, everything tied
 *                          to the account (see the FK constraints in
 *                          supabase/migrations.sql), then removes the
 *                          Supabase Auth user.
 *
 * Used by /api/account/delete, /api/account/restore,
 * /api/admin/delete-account, /api/admin/restore-account, and
 * /api/cron/purge-deleted-accounts.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

async function cancelStripeSubscriptions(profileId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_subscription_id, ai_addon_subscription_id")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile?.stripe_subscription_id && !profile?.ai_addon_subscription_id) return;

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

export async function softDeleteAccount(profileId: string): Promise<{ error?: string }> {
  await cancelStripeSubscriptions(profileId);

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", profileId);

  return error ? { error: error.message } : {};
}

export async function restoreAccount(profileId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ deleted_at: null })
    .eq("id", profileId);

  return error ? { error: error.message } : {};
}

/** Irreversible. Only call from the purge cron job or an explicit admin override. */
export async function purgeAccount(profileId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();

  await cancelStripeSubscriptions(profileId);

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
