import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBusinessId } from "@/lib/team";

/**
 * POST /api/billing/start-trial
 *
 * A directory claim is a login for the listing only (account_type =
 * 'directory'), with no app access and no trial. This is how it opts in
 * to SwiftScope: from the listing editor, once, it starts the same 7-day
 * trial a /signup user gets and becomes a platform account.
 *
 * Also covers a platform owner whose trial never started (trial_ends_at
 * null), which used to read as "free trial, 0 days left" on /billing.
 * Never for anyone subscribed or comped. An ended trial on a platform
 * account has a past date, not null, so it cannot be restarted.
 */
const TRIAL_DAYS = 7;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const businessId = await getActiveBusinessId(supabase, user.id);
  if (businessId !== user.id) {
    return NextResponse.json({ error: "Only the business owner can start the trial." }, { status: 403 });
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
  // Either a directory login opting in to the app (some carry a stale
  // trial date from before directory logins existed, so the date is not
  // checked for them), or a platform account whose trial never started.
  // Turning to 'platform' here means this can only ever happen once.
  const { data, error } = await createAdminClient()
    .from("profiles")
    .update({ trial_ends_at: trialEndsAt, account_type: "platform" })
    .eq("id", user.id)
    .or("account_type.eq.directory,trial_ends_at.is.null")
    .not("comp_access", "is", true)
    .or("subscription_status.is.null,subscription_status.eq.none")
    .select("trial_ends_at");
  if (error) {
    console.error("[billing/start-trial] update failed:", error.message);
    return NextResponse.json({ error: "Couldn't start the trial. Try again or email team@swiftscope.com.au." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Your free trial has already been used." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, trialEndsAt: data[0].trial_ends_at });
}
