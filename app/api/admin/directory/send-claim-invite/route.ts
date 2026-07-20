import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { buildDirectorySlug } from "@/lib/seo/meta";

/**
 * Sends a "claim your free listing" invite email to selected directory_listing
 * rows -- built for manually-added leads (e.g. businesses found on hiPages
 * and added one at a time via the "Add tradie" form with an email address),
 * not for bulk-emailing the whole Google Places-sourced directory.
 *
 * Deliberately per-recipient rather than reusing /api/admin/outreach as-is --
 * each email links to that specific listing's claim page, prefilled with
 * their own business name/suburb/trade, not one shared template.
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

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }
  const FROM = process.env.RESEND_FROM_EMAIL ?? "team@swiftscope.com.au";

  const admin = createAdminClient();
  const { data: listings, error } = await admin
    .from("directory_listing")
    .select("id, business_name, suburb, trades, scraped_contact_email, private_email, is_claimed")
    .in("id", listingIds);

  if (error) {
    return NextResponse.json({ error: "Failed to load listings" }, { status: 500 });
  }

  const results = { sent: 0, skippedNoEmail: 0, skippedAlreadyClaimed: 0, failed: 0, errors: [] as string[] };

  for (const listing of listings ?? []) {
    const toEmail = listing.scraped_contact_email || listing.private_email;
    if (!toEmail) { results.skippedNoEmail++; continue; }
    if (listing.is_claimed) { results.skippedAlreadyClaimed++; continue; }

    const trade = listing.trades?.[0] ?? "";
    const claimUrl = `https://swiftscope.com.au/directory/claim?name=${encodeURIComponent(listing.business_name)}&suburb=${encodeURIComponent(listing.suburb ?? "")}&trade=${encodeURIComponent(trade)}`;
    const listingUrl = `https://swiftscope.com.au/directory/${buildDirectorySlug({ id: listing.id, business_name: listing.business_name, suburb: listing.suburb ?? "" })}`;

    const subject = `${listing.business_name} -- your free Swiftscope directory page is ready`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #0a1722;">
        <p>Hi,</p>
        <p>We've set up a free directory page for <strong>${listing.business_name}</strong> on Swiftscope, an Australian directory for trade businesses, built for homeowners searching for a tradie in your area.</p>
        <p>You can see it here: <a href="${listingUrl}">${listingUrl}</a></p>
        <p>It's free to claim, no credit card, no catch. Once you claim it you can add photos, your licence details, services you offer, and start receiving quote requests directly.</p>
        <p><a href="${claimUrl}" style="display:inline-block;background:#ffb400;color:#0a1722;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;">Claim your free listing</a></p>
        <p style="color:#5a6b78;font-size:13px;">If this isn't your business, you can ignore this email.</p>
      </div>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({ from: `Swiftscope <${FROM}>`, to: toEmail, subject, html }),
      });
      if (res.ok) {
        results.sent++;
      } else {
        results.failed++;
        const err = await res.json().catch(() => ({}));
        results.errors.push(`${toEmail}: ${err.message ?? res.status}`);
      }
    } catch (e) {
      results.failed++;
      results.errors.push(`${toEmail}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  return NextResponse.json(results);
}
