import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLAIMED_DIRECTORY_PAGES_ENABLED } from "@/lib/featureFlags";

/**
 * Resolves a claim_token straight to its exact directory_listing row - no
 * fuzzy name/trade/suburb search needed. Used by outreach links (HubSpot
 * export, admin claim-invite) so clicking through lands the tradie on a
 * single confirmed match instead of having to search for their own
 * business and pick it out of a list.
 *
 * Uses the admin client for the actual read since directory_listing has no
 * end-user RLS policy (admin-managed, public-read only via the page routes,
 * not via this API) - but still requires a session, consistent with
 * lookup/route.ts, since this only makes sense mid-claim-flow (after the
 * auth step) not as a public unauthenticated endpoint.
 */
export async function POST(req: NextRequest) {
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

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: listing, error } = await admin
    .from("directory_listing")
    .select("id, business_name, suburb, trades, google_rating, google_reviews_count, logo_url, is_claimed")
    .eq("claim_token", token)
    .maybeSingle();

  if (error || !listing) {
    return NextResponse.json({ error: "This claim link isn't valid. Try searching for your business instead." }, { status: 404 });
  }

  return NextResponse.json({
    match: {
      id: listing.id,
      business_name: listing.business_name,
      suburb: listing.suburb,
      trades: listing.trades,
      google_rating: listing.google_rating,
      google_reviews_count: listing.google_reviews_count,
      logo_url: listing.logo_url,
      similarity: 1,
    },
    isClaimed: listing.is_claimed === true,
  });
}
