import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBusinessId } from "@/lib/team";
import { CLAIMED_DIRECTORY_PAGES_ENABLED } from "@/lib/featureFlags";

function currentMonthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * GET: returns the current month's self-set target (if any) plus progress,
 * for the owner's claimed listing only. Progress is currently counted from
 * directory_enquiries (the existing quote-request capture table) since
 * quote submissions aren't yet wired into the real quotes table -- update
 * this count source once that wiring lands.
 *
 * Uses the admin client for the actual reads/writes (session client is only
 * for auth.getUser() + getActiveBusinessId, which correctly resolves team
 * members to their owner's business id) -- directory_goals' own RLS policy
 * checks profile_id = auth.uid() directly and would otherwise block a team
 * member acting on the owner's behalf.
 */
export async function GET() {
  if (!CLAIMED_DIRECTORY_PAGES_ENABLED) {
    return NextResponse.json({ error: "Not available yet" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = await getActiveBusinessId(supabase, user.id);
  const admin = createAdminClient();
  const monthStart = currentMonthStart();

  const { data: listing } = await admin
    .from("directory_listing")
    .select("id")
    .eq("profile_id", businessId)
    .maybeSingle();

  if (!listing) {
    return NextResponse.json({ error: "No claimed listing for this business" }, { status: 404 });
  }

  const { data: goal } = await admin
    .from("directory_goals")
    .select("target_quotes")
    .eq("profile_id", businessId)
    .eq("month_start", monthStart)
    .maybeSingle();

  const { count } = await admin
    .from("directory_enquiries")
    .select("*", { count: "exact", head: true })
    .eq("listing_id", listing.id)
    .gte("created_at", `${monthStart}T00:00:00Z`);

  return NextResponse.json({
    monthStart,
    targetQuotes: goal?.target_quotes ?? null,
    quoteCount: count ?? 0,
  });
}

/**
 * POST: sets (or updates) the current month's self-set target. Private to
 * the tradie -- there is no public score, leaderboard, or ranking built on
 * top of this.
 */
export async function POST(req: NextRequest) {
  if (!CLAIMED_DIRECTORY_PAGES_ENABLED) {
    return NextResponse.json({ error: "Not available yet" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = await getActiveBusinessId(supabase, user.id);
  const admin = createAdminClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetQuotes = Number(body.targetQuotes);
  if (!Number.isInteger(targetQuotes) || targetQuotes <= 0) {
    return NextResponse.json({ error: "targetQuotes must be a positive whole number" }, { status: 400 });
  }

  const monthStart = currentMonthStart();

  const { error } = await admin
    .from("directory_goals")
    .upsert(
      { profile_id: businessId, month_start: monthStart, target_quotes: targetQuotes, updated_at: new Date().toISOString() },
      { onConflict: "profile_id,month_start" }
    );

  if (error) {
    return NextResponse.json({ error: "Failed to save goal" }, { status: 500 });
  }

  return NextResponse.json({ monthStart, targetQuotes });
}
