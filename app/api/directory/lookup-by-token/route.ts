import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLAIMED_DIRECTORY_PAGES_ENABLED } from "@/lib/featureFlags";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

/**
 * Resolves a claim_token straight to its exact directory_listing row - no
 * fuzzy name/trade/suburb search needed. Used by outreach links (HubSpot
 * export, admin claim-invite) so clicking through lands the tradie on a
 * single confirmed match instead of having to search for their own
 * business and pick it out of a list.
 *
 * Was auth-gated until this route started 401ing on real traffic, for the
 * same reason as lookup/route.ts: the claim page's account-creation step
 * moved from first to last, so resolveEntryStep() (which calls this route)
 * now runs before auth for everyone, including someone clicking straight
 * in from an outreach email who has never signed up yet -- exactly who
 * this route exists for.
 *
 * The auth check was never the actual security boundary here anyway. The
 * token is: it is an unguessable value emailed to one specific business,
 * and this uses the admin client (bypasses RLS) purely because
 * directory_listing has no end-user RLS policy for this shape of read, not
 * because a session was doing any gatekeeping. Everything returned here
 * (business_name, suburb, trades, rating, logo) is the same public data
 * already shown on that business's own public listing page.
 */
export async function POST(req: NextRequest) {
  if (!CLAIMED_DIRECTORY_PAGES_ENABLED) {
    return NextResponse.json({ error: "Not available yet" }, { status: 404 });
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit(`directory-lookup-token:${ip ?? "unknown"}`, 20, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait a moment and try again." }, { status: 429, headers: rl.retryAfterSeconds ? { "Retry-After": String(rl.retryAfterSeconds) } : undefined });
  }

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
