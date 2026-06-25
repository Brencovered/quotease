import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const priceId = process.env.STRIPE_PRICE_AI_ADDON;
  if (!priceId) {
    return NextResponse.json({ error: "AI add-on pricing is not configured on this deployment" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, contact_email, business_name")
    .eq("id", userData.user.id)
    .single();

  const stripe = getStripe();

  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.contact_email ?? userData.user.email ?? undefined,
      name: profile?.business_name ?? undefined,
      metadata: { profile_id: userData.user.id },
    });
    customerId = customer.id;
    await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userData.user.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  // No trial on the add-on - the 3 free analyses already serve that purpose,
  // so a second trial period here would just be double-dipping.
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: { profile_id: userData.user.id, plan: "ai_addon" },
    },
    success_url: `${appUrl}/settings?addon=success`,
    cancel_url: `${appUrl}/settings?addon=canceled`,
  });

  return NextResponse.json({ url: session.url });
}
