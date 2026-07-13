import { NextResponse } from "next/server";
import { getStripe, STRIPE_PRICE_IDS } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

// subscription.metadata.plan is set at checkout time (see
// app/api/stripe/checkout/route.ts), but any subscription created outside
// that one code path - a manual dashboard subscription, a plan created via
// the Stripe CLI, a future migration that forgets to set it - would
// otherwise leave subscription_plan permanently null even though the
// subscription is genuinely active. Fall back to matching the actual Stripe
// Price ID so plan is never silently unknown for a real paid subscription.
function derivePlan(subscription: Stripe.Subscription): string | null {
  if (subscription.metadata.plan) return subscription.metadata.plan;
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return null;
  if (priceId === STRIPE_PRICE_IDS.monthly) return "monthly";
  if (priceId === STRIPE_PRICE_IDS.annual) return "annual";
  return null;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  const stripe = getStripe();
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${err}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  async function syncSubscription(subscription: Stripe.Subscription) {
    const profileId = subscription.metadata.profile_id;
    if (!profileId) return; // not one of our subscriptions

    if (subscription.metadata.plan === "ai_addon") {
      await supabase
        .from("profiles")
        .update({
          ai_addon_status: subscription.status === "active" ? "active" : "canceled",
          ai_addon_subscription_id: subscription.id,
        })
        .eq("id", profileId);
      return;
    }

    const item = subscription.items.data[0];
    await supabase
      .from("profiles")
      .update({
        subscription_status: subscription.status, // trialing, active, past_due, canceled, etc.
        subscription_plan: derivePlan(subscription),
        trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        current_period_end: item?.current_period_end
          ? new Date(item.current_period_end * 1000).toISOString()
          : null,
        stripe_subscription_id: subscription.id,
        cancel_at_period_end: subscription.cancel_at_period_end,
      })
      .eq("id", profileId);
  }

  async function cancelSubscription(subscription: Stripe.Subscription) {
    const profileId = subscription.metadata.profile_id;
    if (!profileId) return;
    if (subscription.metadata.plan === "ai_addon") {
      await supabase.from("profiles").update({ ai_addon_status: "canceled" }).eq("id", profileId);
    } else {
      await supabase.from("profiles").update({ subscription_status: "canceled", cancel_at_period_end: false }).eq("id", profileId);
    }
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.trial_will_end":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await cancelSubscription(subscription);
      break;
    }

    // Checkout completing immediately fires a subscription.created event too,
    // but this catches the case where it doesn't for any reason.
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await syncSubscription(subscription);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
