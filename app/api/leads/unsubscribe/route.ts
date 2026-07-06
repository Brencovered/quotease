import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/leads/unsubscribe
 * ----------------------------
 * Opt a tradie OUT of lead notifications.
 * 
 * Body options:
 *   { trade, suburb } — opt out of a specific trade+suburb combo
 *   {} (empty) — opt out of ALL lead notifications
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trade, suburb } = await req.json().catch(() => ({}));

  if (trade && suburb) {
    // Deactivate a specific subscription
    const { error } = await supabase
      .from("lead_subscriptions")
      .update({ is_active: false })
      .eq("profile_id", user.id)
      .eq("trade", trade.toLowerCase())
      .ilike("suburb", suburb.trim());

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, trade, suburb, is_active: false });
  }

  // No specific trade/suburb — deactivate ALL subscriptions
  const { error } = await supabase
    .from("lead_subscriptions")
    .update({ is_active: false })
    .eq("profile_id", user.id)
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, message: "All lead notifications paused" });
}
