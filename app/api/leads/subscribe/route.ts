import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/leads/subscribe
 * --------------------------
 * Opt a tradie back IN to lead notifications for a specific trade+suburb.
 * If no trade/suburb provided, reactivates all their inactive subscriptions.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trade, suburb } = await req.json().catch(() => ({}));

  if (trade && suburb) {
    // Reactivate a specific trade+suburb combo
    const { error } = await supabase
      .from("lead_subscriptions")
      .upsert(
        {
          profile_id: user.id,
          trade: trade.toLowerCase(),
          suburb: suburb.trim(),
          is_active: true,
        },
        { onConflict: "profile_id,trade,suburb", ignoreDuplicates: false }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, trade, suburb, is_active: true });
  }

  // No specific trade/suburb — reactivate ALL inactive subscriptions
  const { error } = await supabase
    .from("lead_subscriptions")
    .update({ is_active: true })
    .eq("profile_id", user.id)
    .eq("is_active", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, message: "All subscriptions reactivated" });
}
