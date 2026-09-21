import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { buildDirectorySlug } from "@/lib/seo/meta";
import { buildDirectoryClaimInviteEmail } from "@/lib/email/templates";

/**
 * Renders the exact email /api/admin/directory/send-claim-invite would
 * send for each listing, without sending anything - real ask was
 * "I need to be able to review the emails going out" before a send
 * happens, not just a bare "N businesses selected" count.
 *
 * Deliberately mirrors send-claim-invite's own claimUrl/listingUrl
 * construction exactly (same name/suburb/trade query params, same
 * buildDirectorySlug call) rather than reusing a shared helper that
 * doesn't exist yet - if these two ever drift apart, this preview
 * would show something different from what actually gets sent, which
 * defeats the entire point of previewing. Worth a follow-up to factor
 * this into one shared function both routes call, rather than two
 * copies that could silently diverge.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: { listingIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const listingIds = Array.isArray(body.listingIds) ? body.listingIds : [];
  if (listingIds.length === 0) {
    return NextResponse.json({ error: "No listings selected" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: listings, error } = await admin
    .from("directory_listing")
    .select("id, business_name, suburb, trades, scraped_contact_email, private_email, is_claimed")
    .in("id", listingIds);

  if (error) {
    return NextResponse.json({ error: "Failed to load listings" }, { status: 500 });
  }

  const previews = (listings ?? []).map((listing) => {
    const toEmail = listing.scraped_contact_email || listing.private_email;
    const trade = listing.trades?.[0] ?? "";
    const claimUrl = `https://swiftscope.com.au/directory/claim?name=${encodeURIComponent(listing.business_name)}&suburb=${encodeURIComponent(listing.suburb ?? "")}&trade=${encodeURIComponent(trade)}`;
    const listingUrl = `https://swiftscope.com.au/directory/${buildDirectorySlug({ id: listing.id, business_name: listing.business_name, suburb: listing.suburb ?? "" })}`;

    const { subject, html } = buildDirectoryClaimInviteEmail({
      businessName: listing.business_name,
      claimUrl,
      listingUrl,
    });

    return {
      id: listing.id,
      businessName: listing.business_name,
      toEmail: toEmail || null,
      isClaimed: listing.is_claimed,
      subject,
      html,
    };
  });

  return NextResponse.json({ previews });
}
