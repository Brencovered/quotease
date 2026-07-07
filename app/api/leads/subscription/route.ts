import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

/**
 * GET /api/leads/subscription
 * ----------------------------
 * Returns the current lead subscription status for the authenticated tradie.
 * Used by the settings page to show opt-in/opt-out status.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, user.id);

  const { data: subscriptions, error } = await supabase
    .from("lead_subscriptions")
    .select("trade, suburb, is_active, created_at")
    .eq("profile_id", businessId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const active = (subscriptions ?? []).filter((s) => s.is_active);
  const inactive = (subscriptions ?? []).filter((s) => !s.is_active);

  return NextResponse.json({
    subscriptions: subscriptions ?? [],
    summary: {
      total: subscriptions?.length ?? 0,
      active: active.length,
      inactive: inactive.length,
      fullyOptedOut: subscriptions && subscriptions.length > 0 && active.length === 0,
    },
  });
}
