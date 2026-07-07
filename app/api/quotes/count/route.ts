import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

/**
 * GET /api/quotes/count
 * ----------------------
 * Powers the small badge next to "Quotes" in the nav (AppHeader.tsx).
 * This route never actually existed - AppHeader has been calling it on
 * every page load since it was added, always 404ing and silently
 * falling back to a badge of 0 (the fetch is wrapped in a try/catch
 * with no visible error), which is why nobody noticed until it started
 * showing up in the browser console.
 *
 * Definition: sent quotes whose follow-up date has passed - the same
 * "needs your attention" definition already used for overdueFollowUps
 * on the main dashboard (lib/dashboardStats.ts), so the badge and the
 * dashboard agree on what counts as overdue.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ count: 0 });
  }
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { count } = await supabase
    .from("quotes")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", businessId)
    .eq("status", "sent")
    .lt("follow_up_at", new Date().toISOString());

  return NextResponse.json({ count: count ?? 0 });
}
