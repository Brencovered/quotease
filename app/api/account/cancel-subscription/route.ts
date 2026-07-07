/**
 * POST /api/account/cancel-subscription
 * --------------------------------------
 * Self-service. Cancels the logged-in tradie's own subscription at the end
 * of the current billing period (they keep access they've already paid
 * for -- no immediate cutoff). Pass { resume: true } to undo a pending
 * cancellation before it takes effect.
 *
 * Body: { resume?: boolean }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getActiveBusinessId } from "@/lib/team";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { resume } = (await request.json().catch(() => ({}))) as { resume?: boolean };

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", businessId)
    .single();

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription found on this account." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: !resume,
    });

    // Optimistic update -- the webhook will also sync this shortly, but the
    // tradie shouldn't have to refresh to see the result of their own click.
    await supabase
      .from("profiles")
      .update({ cancel_at_period_end: subscription.cancel_at_period_end })
      .eq("id", businessId);

    return NextResponse.json({
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
        : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update subscription." }, { status: 502 });
  }
}
