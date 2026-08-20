import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBusinessId } from "@/lib/team";
import { CLAIMED_DIRECTORY_PAGES_ENABLED } from "@/lib/featureFlags";
import { buildDirectorySlug } from "@/lib/seo/meta";
import { verifyAbn } from "@/lib/abnLookup";
import { getClientIp, getUserAgent } from "@/lib/clientIp";
import { isIpBlocked } from "@/lib/ipBlocklist";

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
 *
 * The session client is used only to establish identity (auth.getUser() +
 * getActiveBusinessId, which correctly resolves team members to their
 * owner's business id). All actual reads/writes to directory_listing and
 * directory_claim_attempts go through the admin client -- directory_listing
 * has no owner-scoped RLS policy (it's admin-managed, public-read only),
 * and directory_claim_attempts intentionally has no end-user policies at
 * all (audit log, admin-readable only) -- so the session client would
 * silently fail (0 rows affected under RLS, no thrown error) on every
 * write here.
 *
 * An optional ABN is stored on the profile if provided, but is NOT verified
 * here -- ABN Lookup verification (and setting directory_badge_verified)
 * is a separate step, not yet built.
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

  // Recorded on every claim attempt, successful or not. There was no way to
  // investigate four suspicious signups because nothing captured where they
  // came from, and Supabase's own auth audit log is pruned and empty.
  // Evidence for a human to weigh, never an authorisation control.
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);

  if (await isIpBlocked(ipAddress)) {
    console.warn(`[directory/claim] blocked IP attempted a claim: ${ipAddress}`);
    return NextResponse.json(
      { error: "Unable to process this request. Contact support if you believe this is a mistake." },
      { status: 403 }
    );
  }

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
  const postcode = typeof body.postcode === "string" ? body.postcode.trim() : "";
  const abn = typeof body.abn === "string" ? body.abn.replace(/\s+/g, "") : "";
  const logoUrl = typeof body.logoUrl === "string" ? body.logoUrl.trim() : "";
  const streetAddress = typeof body.streetAddress === "string" ? body.streetAddress.trim() : "";
  const contactPhone = typeof body.contactPhone === "string" ? body.contactPhone.trim() : "";

  if (!businessName || !trade || !suburb) {
    return NextResponse.json(
      { error: "Business name, trade, and suburb are required" },
      { status: 400 }
    );
  }

  // Address and contact phone are only mandatory when creating a brand new
  // listing (no listingId, ie no existing scraped listing matched). A
  // claimed listing already has scraped_contact_phone from the Google
  // import; forcing a fresh phone number here would break that path for no
  // reason. This is also why the check sits after the listingId lookup
  // rather than the generic required-fields block above.
  const isCreatingNew = !listingId;
  if (isCreatingNew && (!streetAddress || !contactPhone)) {
    return NextResponse.json(
      { error: "Business address and contact number are required" },
      { status: 400 }
    );
  }

  // AU phone numbers only: 10 digits, or +61 with 9. Stripped of spaces and
  // punctuation before the check so "0412 345 678" and "0412-345-678" both
  // pass. Only checked when a phone was actually supplied -- on the claim
  // path it may legitimately be blank.
  const phoneDigits = contactPhone.replace(/[\s()-]/g, "");
  if (contactPhone && !/^(\+?61|0)\d{9}$/.test(phoneDigits)) {
    return NextResponse.json(
      { error: "Please enter a valid Australian phone number" },
      { status: 400 }
    );
  }

  if (postcode && !/^\d{4}$/.test(postcode)) {
    return NextResponse.json({ error: "Postcode must be 4 digits" }, { status: 400 });
  }

  // City-only suburb, checked up front so it covers both branches below
  // (claiming an existing listing and creating a new one), not just new
  // listing creation. Two of the three 103.78.46.30 accounts entered
  // "Melbourne" here instead of a real suburb.
  if (/^(melbourne|sydney|brisbane|perth|adelaide|canberra|hobart|darwin)$/i.test(suburb)) {
    return NextResponse.json(
      { error: "Please enter your actual suburb, not just the city." },
      { status: 400 }
    );
  }

  if (!VALID_TRADES.includes(trade)) {
    return NextResponse.json({ error: "Unrecognised trade" }, { status: 400 });
  }

  // One claimed listing per business in v1 -- a business wanting to add a
  // second trade/suburb combination extends their existing listing rather
  // than claiming a second one.
  const { data: existingClaim } = await admin
    .from("directory_listing")
    .select("id, business_name, suburb")
    .eq("profile_id", businessId)
    .maybeSingle();

  if (existingClaim) {
    const existingSlug = buildDirectorySlug({
      id: existingClaim.id,
      business_name: existingClaim.business_name,
      suburb: existingClaim.suburb ?? "",
    });
    return NextResponse.json(
      {
        error: `This account already manages a different claimed listing (${existingClaim.business_name}). Only one claimed listing is allowed per account in this version.`,
        existingBusinessName: existingClaim.business_name,
        existingSlug,
      },
      { status: 409 }
    );
  }

  let verifiedBadge = false;
  if (abn) {
    const verification = await verifyAbn(abn);
    verifiedBadge = verification.valid && verification.active === true;
    await admin.from("profiles").update({
      abn,
      abn_verified_at: verifiedBadge ? new Date().toISOString() : null,
      directory_badge_verified: verifiedBadge,
    }).eq("id", businessId);
  }

  if (listingId) {
    // Claiming an existing scraped listing.
    const { data: listing, error: fetchErr } = await admin
      .from("directory_listing")
      .select("id, is_claimed, business_name, suburb, logo_url, scraped_contact_email, private_email, claim_token")
      .eq("id", listingId)
      .single();

    if (fetchErr || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.is_claimed) {
      await admin.from("directory_claim_attempts").insert({
        attempted_business_name: businessName,
        suburb,
        trade,
        matched_listing_id: listingId,
        attempted_by_profile_id: businessId,
        outcome: "disputed",
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return NextResponse.json(
        { error: "This listing has already been claimed. Contact support if you believe this is a mistake." },
        { status: 409 }
      );
    }

    // Ownership check. Claiming a scraped listing is the case that can
    // actually harm someone: the business did not sign up, has no idea the
    // page exists, and a competitor taking it over would be invisible to
    // them. Creating a brand new listing carries no such risk, which is why
    // this gate applies only here.
    //
    // The test is whether the signed-in address matches the contact address
    // already on the listing, which came from the business's own public
    // Google entry. Matching means they demonstrably control the address the
    // business publishes. Not matching does not block the claim -- plenty of
    // tradies genuinely run a Gmail while their website shows info@ on their
    // domain -- but it is recorded as unverified so a dispute can be settled
    // on evidence rather than argument.
    const knownContact = (listing.scraped_contact_email || listing.private_email || "").toLowerCase().trim();
    const claimantEmail = (user.email ?? "").toLowerCase().trim();
    const verifiedViaEmail = knownContact && knownContact === claimantEmail ? claimantEmail : null;

    const { error: updateErr } = await admin
      .from("directory_listing")
      .update({
        is_claimed: true,
        profile_id: businessId,
        // Only fill in a logo if the scraped listing doesn't already have
        // one -- never overwrite an existing (e.g. Google-sourced) logo
        // with nothing just because the tradie skipped this step.
        ...(logoUrl && !listing.logo_url ? { logo_url: logoUrl } : {}),
      })
      .eq("id", listingId)
      .eq("is_claimed", false); // belt-and-braces against a race between two concurrent claims

    if (updateErr) {
      return NextResponse.json({ error: "Failed to claim listing" }, { status: 500 });
    }

    await admin.from("directory_claim_attempts").insert({
      attempted_business_name: businessName,
      suburb,
      trade,
      matched_listing_id: listingId,
      attempted_by_profile_id: businessId,
      outcome: "claimed",
      ip_address: ipAddress,
      user_agent: userAgent,
      verified_via_email: verifiedViaEmail,
    });

    const slug = buildDirectorySlug({ id: listing.id, business_name: listing.business_name, suburb: listing.suburb ?? "" });
    return NextResponse.json({ listingId, outcome: "claimed", slug, verifiedBadge, ownershipVerified: verifiedViaEmail !== null });
  }

  // Rate limit new listing creation per IP. 103.78.46.30 created three
  // listing-owning accounts (one later found to have created none, two that
  // did) across 24 hours before anyone noticed. This is the mechanical
  // version of what stopped it: three from one address in a day should
  // throttle itself, not wait for someone to spot it in the logs.
  if (ipAddress) {
    const { count } = await admin
      .from("listing_creation_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ipAddress)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if ((count ?? 0) >= 2) {
      console.warn(`[directory/claim] rate limit hit for new listing creation: ${ipAddress}`);
      return NextResponse.json(
        { error: "Too many listings created recently from this connection. Contact support if you need help." },
        { status: 429 }
      );
    }
  }

  // No match -- create a brand new listing, owned and verified from day one.
  const { data: created, error: createErr } = await admin
    .from("directory_listing")
    .insert({
      business_name: businessName,
      trades: [trade],
      suburb,
      postcode: postcode || null,
      street_address: streetAddress,
      contact_phone: phoneDigits,
      logo_url: logoUrl || null,
      profile_id: businessId,
      is_claimed: true,
      source: "manual",
    })
    .select("id")
    .single();

  if (createErr || !created) {
    console.error("[directory/claim] listing insert failed:", createErr?.message);
    return NextResponse.json(
      { error: createErr?.message?.includes("business_name is required")
          ? "A business name is required."
          : createErr?.message?.includes("suburb must be a real suburb")
          ? "Please enter your actual suburb, not just the city."
          : createErr?.message?.includes("contact_phone is required")
          ? "A contact number is required."
          : "Failed to create listing" },
      { status: 400 }
    );
  }

  // Record the attempt for the rate limiter above, success or not mattering
  // less than the fact an attempt was made from this IP.
  await admin.from("listing_creation_attempts").insert({ ip_address: ipAddress, profile_id: businessId });

  await admin.from("directory_claim_attempts").insert({
    attempted_business_name: businessName,
    suburb,
    trade,
    matched_listing_id: created.id,
    attempted_by_profile_id: businessId,
    outcome: "created_new",
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  const slug = buildDirectorySlug({ id: created.id, business_name: businessName, suburb });
  return NextResponse.json({ listingId: created.id, outcome: "created_new", slug, verifiedBadge });
}
