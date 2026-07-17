import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import { CLAIMED_DIRECTORY_PAGES_ENABLED } from "@/lib/featureFlags";

const VALID_TRADES = [
  "electrician", "plumber", "builder", "roofer", "painter", "carpenter",
  "tiler", "landscaper", "concreter", "fencer", "plasterer", "handyman",
];

/**
 * Resolves the business lookup step: either claims an existing unclaimed
 * directory_listing row, or creates a brand new one when no match exists.
 * Both paths are logged to directory_claim_attempts for /admin dispute
 * resolution. First successful claim locks the listing -- enforced by
 * a is_claimed check-then-set here, backstopped by the fact that a second
 * concurrent claim attempt will simply find is_claimed already true.
 */
export async function POST(req: NextRequest) {
  if (!CLAIMED_DIRECTORY_PAGES_ENABLED) {
    return NextResponse.json({ error: "Not available yet" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = await getActiveBusinessId(supabase, user.id);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const listingId = typeof body.listingId === "string" ? body.listingId : null;
  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
  const trade = typeof body.trade === "string" ? body.trade.trim() : "";
  const suburb = typeof body.suburb === "string" ? body.suburb.trim() : "";

  if (!businessName || !trade || !suburb) {
    return NextResponse.json(
      { error: "Business name, trade, and suburb are required" },
      { status: 400 }
    );
  }

  if (!VALID_TRADES.includes(trade)) {
    return NextResponse.json({ error: "Unrecognised trade" }, { status: 400 });
  }

  // One claimed listing per business in v1 -- a business wanting to add a
  // second trade/suburb combination extends their existing listing rather
  // than claiming a second one.
  const { data: existingClaim } = await supabase
    .from("directory_listing")
    .select("id")
    .eq("profile_id", businessId)
    .maybeSingle();

  if (existingClaim) {
    return NextResponse.json(
      { error: "This business has already claimed a directory listing" },
      { status: 409 }
    );
  }

  if (listingId) {
    // Claiming an existing scraped listing.
    const { data: listing, error: fetchErr } = await supabase
      .from("directory_listing")
      .select("id, is_claimed")
      .eq("id", listingId)
      .single();

    if (fetchErr || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.is_claimed) {
      await supabase.from("directory_claim_attempts").insert({
        attempted_business_name: businessName,
        suburb,
        trade,
        matched_listing_id: listingId,
        attempted_by_profile_id: businessId,
        outcome: "disputed",
      });
      return NextResponse.json(
        { error: "This listing has already been claimed. Contact support if you believe this is a mistake." },
        { status: 409 }
      );
    }

    const { error: updateErr } = await supabase
      .from("directory_listing")
      .update({ is_claimed: true, profile_id: businessId })
      .eq("id", listingId)
      .eq("is_claimed", false); // belt-and-braces against a race between two concurrent claims

    if (updateErr) {
      return NextResponse.json({ error: "Failed to claim listing" }, { status: 500 });
    }

    await supabase.from("directory_claim_attempts").insert({
      attempted_business_name: businessName,
      suburb,
      trade,
      matched_listing_id: listingId,
      attempted_by_profile_id: businessId,
      outcome: "claimed",
    });

    return NextResponse.json({ listingId, outcome: "claimed" });
  }

  // No match -- create a brand new listing, owned and verified from day one.
  const { data: created, error: createErr } = await supabase
    .from("directory_listing")
    .insert({
      business_name: businessName,
      trades: [trade],
      suburb,
      profile_id: businessId,
      is_claimed: true,
      source: "manual",
    })
    .select("id")
    .single();

  if (createErr || !created) {
    return NextResponse.json({ error: "Failed to create listing" }, { status: 500 });
  }

  await supabase.from("directory_claim_attempts").insert({
    attempted_business_name: businessName,
    suburb,
    trade,
    matched_listing_id: created.id,
    attempted_by_profile_id: businessId,
    outcome: "created_new",
  });

  return NextResponse.json({ listingId: created.id, outcome: "created_new" });
}
