import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CLAIMED_DIRECTORY_PAGES_ENABLED } from "@/lib/featureFlags";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

/**
 * Business lookup step shared by both the free claimed directory page and
 * the $45 plan signup. Searches unclaimed directory_listing rows via the
 * search_directory_listings_fuzzy() Postgres function (exact match falls
 * out of this naturally as similarity 1.0) so a new signup can either
 * claim an existing scraped listing or be told none exists and create one.
 *
 * Was auth-gated until this route started 401ing on real traffic: the
 * claim page's account-creation step was moved from first to last (see
 * app/directory/claim/page.tsx), specifically so people can search and see
 * their business matched before being asked for an account -- but this
 * route still assumed the old order, where search only ever happened
 * after signup. The comment here used to say exactly that; it was
 * describing an assumption the UI reorder deliberately broke.
 *
 * Not actually a security requirement, just an accidental dependency on
 * page order: nothing in this handler uses `user` for anything beyond the
 * gate itself, directory_listing already has a public anon SELECT policy
 * (this data is not sensitive -- every one of these listings has its own
 * public page), and anon already has execute on the underlying RPC.
 * Removing the auth check does not expose anything that was not already
 * public; it just lets an anonymous visitor reach the same public data
 * through this endpoint instead of only through /directory pages.
 *
 * IP-rate-limited in its place, since making a search endpoint callable
 * without an account does mean it can now be hit at volume with no signup
 * required first, which the old auth gate incidentally prevented as a
 * side effect even though that was never its purpose.
 */
export async function POST(req: NextRequest) {
  // Defense in depth: nothing should link here while the feature is off,
  // but guard the route itself too rather than relying only on the UI
  // not surfacing an entry point.
  if (!CLAIMED_DIRECTORY_PAGES_ENABLED) {
    return NextResponse.json({ error: "Not available yet" }, { status: 404 });
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit(`directory-lookup:${ip ?? "unknown"}`, 20, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many searches. Please wait a moment and try again." }, { status: 429, headers: rl.retryAfterSeconds ? { "Retry-After": String(rl.retryAfterSeconds) } : undefined });
  }

  const supabase = await createClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
  const trade = typeof body.trade === "string" ? body.trade.trim() : null;
  const suburb = typeof body.suburb === "string" ? body.suburb.trim() : null;
  const postcode = typeof body.postcode === "string" ? body.postcode.trim() : null;

  if (!businessName) {
    return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("search_directory_listings_fuzzy", {
    p_name: businessName,
    p_trade: trade,
    p_suburb: suburb,
    p_postcode: postcode,
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
