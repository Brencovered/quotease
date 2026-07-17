import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CLAIMED_DIRECTORY_PAGES_ENABLED } from "@/lib/featureFlags";

/**
 * Business lookup step shared by both the $4.99 standalone claim flow and
 * the $45 plan signup. Searches unclaimed directory_listing rows via the
 * search_directory_listings_fuzzy() Postgres function (exact match falls
 * out of this naturally as similarity 1.0) so a new signup can either
 * claim an existing scraped listing or be told none exists and create one.
 *
 * Auth-gated (not public): the caller must already have a Supabase session,
 * consistent with every other business-scoped route in the app. This runs
 * after account creation but before/during onboarding, not before signup.
 */
export async function POST(req: NextRequest) {
  // Defense in depth: nothing should link here while the feature is off,
  // but guard the route itself too rather than relying only on the UI
  // not surfacing an entry point.
  if (!CLAIMED_DIRECTORY_PAGES_ENABLED) {
    return NextResponse.json({ error: "Not available yet" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
  const trade = typeof body.trade === "string" ? body.trade.trim() : null;
  const suburb = typeof body.suburb === "string" ? body.suburb.trim() : null;

  if (!businessName) {
    return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("search_directory_listings_fuzzy", {
    p_name: businessName,
    p_trade: trade,
    p_suburb: suburb,
    p_limit: 5,
  });

  if (error) {
    console.error("[directory/lookup] search failed:", error.message);
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 500 });
  }

  const matches = data ?? [];

  // A single very-high-similarity match (near-exact name, same trade/suburb
  // filters already applied) is treated as a strong match worth a direct
  // "is this you?" prompt. Anything below that shows as a pick-list instead
  // of asserting an answer.
  const strongMatch = matches.length === 1 && matches[0].similarity >= 0.75
    ? matches[0]
    : matches.length > 0 && matches[0].similarity >= 0.85
    ? matches[0]
    : null;

  return NextResponse.json({
    matches,
    strongMatch,
    noMatch: matches.length === 0,
  });
}
