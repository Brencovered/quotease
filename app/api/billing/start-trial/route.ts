import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBusinessId } from "@/lib/team";

/**
 * POST /api/billing/start-trial
 *
 * Directory claims (email or Google) deliberately get no platform trial,
 * so claiming a free listing is not a free week of quoting. But a tradie
 * who claimed a listing and then opens the app should be able to start
 * the same 7-day trial a /signup user gets, once. Before this, they hit
 * the billing page with trial_ends_at = null, which read as "free trial,
 * 0 days left" and the only way forward was paying.
 *
 * Only for a business owner whose trial has never started
 * (trial_ends_at is null) and who is not subscribed or comped. An ended
 * trial has a past date, not null, so this cannot be used to restart one.
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
  const { data, error } = await createAdminClient()
    .from("profiles")
    .update({ trial_ends_at: trialEndsAt })
    .eq("id", user.id)
    .is("trial_ends_at", null)
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
