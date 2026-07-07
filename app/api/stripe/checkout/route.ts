import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, STRIPE_PRICE_IDS, TRIAL_DAYS } from "@/lib/stripe";
import { getActiveBusinessId } from "@/lib/team";

export async function POST(request: Request) {
  const { plan } = await request.json();
  if (plan !== "monthly" && plan !== "annual") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const supabase = await createClient();
  const stripe = getStripe();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  // One Stripe subscription per business - a team member checking out
  // should subscribe the business they work for, not spin up a separate
  // customer/subscription under their own individual profile.
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, contact_email, business_name")
    .eq("id", businessId)
    .single();

  // Reuse the existing Stripe customer if this isn't their first time
  // through checkout (e.g. they cancelled a trial and came back).
  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.contact_email ?? userData.user.email ?? undefined,
      name: profile?.business_name ?? undefined,
      metadata: { profile_id: businessId },
    });
    customerId = customer.id;
    await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", businessId);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: STRIPE_PRICE_IDS[plan as "monthly" | "annual"], quantity: 1 }],
    subscription_data: {
      ...(TRIAL_DAYS > 0 ? { trial_period_days: TRIAL_DAYS } : {}),
      metadata: { profile_id: businessId, plan },
    },
    success_url: `${appUrl}/billing?success=1`,
    cancel_url: `${appUrl}/billing?canceled=1`,
  });

  return NextResponse.json({ url: session.url });
}
