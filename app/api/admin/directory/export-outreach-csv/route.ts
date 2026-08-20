import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { buildDirectorySlug } from "@/lib/seo/meta";

const APP_URL = "https://swiftscope.com.au";
const PAGE = 1000;

function csvField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  // Quote every field and escape embedded quotes - simplest way to be
  // safe against commas, newlines, and quotes in scraped business names.
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Exports unclaimed directory listings with a usable email as a CSV, ready
 * to import into HubSpot as a list. Each row includes two URLs, both usable
 * as HubSpot personalization tokens:
 *
 *   listing_url  the public directory page for that business. Link this in
 *                the email body so the recipient can see what already
 *                exists before being asked to do anything. Far stronger
 *                than describing it, and it is the page Google indexes.
 *   claim_url    the claim_token deep link that resolves straight to that
 *                exact listing on /directory/claim, skipping search-and-match.
 *
 * Slug is computed with buildDirectorySlug rather than stored: there is no
 * slug column on directory_listing, and app/directory/[slug] derives the
 * same value, so this stays correct as long as both use the shared helper.
 *
 * Marks outreach_contacted_at on every exported row (unless
 * ?includeContacted=true is passed) so re-running this later only pulls
 * listings that haven't been exported before - avoids double-emailing the
 * same business across separate HubSpot campaigns.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const includeContacted = req.nextUrl.searchParams.get("includeContacted") === "true";
  const admin = createAdminClient();

  type Row = {
    id: string;
    business_name: string | null;
    trades: string[] | null;
    suburb: string | null;
    postcode: string | null;
    google_rating: number | null;
    google_reviews_count: number | null;
    scraped_contact_email: string | null;
    private_email: string | null;
    claim_token: string;
    outreach_contacted_at: string | null;
  };

  const rows: Row[] = [];
  let from = 0;
  while (true) {
    let query = admin
      .from("directory_listing")
      .select("id, business_name, trades, suburb, postcode, google_rating, google_reviews_count, scraped_contact_email, private_email, claim_token, outreach_contacted_at")
      .eq("is_claimed", false)
      .or("scraped_contact_email.not.is.null,private_email.not.is.null")
      .order("business_name")
      .range(from, from + PAGE - 1);

    if (!includeContacted) {
      query = query.is("outreach_contacted_at", null);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[export-outreach-csv] query error:", error.message);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Dedupe by email - a handful of listings share a scraped email
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const email = (r.private_email ?? r.scraped_contact_email ?? "").toLowerCase().trim();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });

  const header = [
    "business_name", "email", "trade", "suburb", "postcode",
    "google_rating", "google_reviews_count", "listing_url", "claim_url", "listing_id",
  ];

  const csvRows = deduped.map((r) => {
    const email = (r.private_email ?? r.scraped_contact_email ?? "").toLowerCase().trim();
    const trade = Array.isArray(r.trades) && r.trades.length > 0 ? r.trades[0] : "";
    const claimUrl = `${APP_URL}/directory/claim?token=${r.claim_token}`;
    // business_name is non-null in practice for every exportable row, but
    // guard anyway: a blank name would produce a slug that 404s, and a dead
    // link in a first-contact cold email is worse than an omitted one.
    const listingUrl = r.business_name
      ? `${APP_URL}/directory/${buildDirectorySlug({
          id: r.id,
          business_name: r.business_name,
          suburb: r.suburb ?? "",
        })}`
      : "";
    return [
      csvField(r.business_name),
      csvField(email),
      csvField(trade),
      csvField(r.suburb),
      csvField(r.postcode),
      csvField(r.google_rating),
      csvField(r.google_reviews_count),
      csvField(listingUrl),
      csvField(claimUrl),
      csvField(r.id),
    ].join(",");
  });

  const csv = [header.join(","), ...csvRows].join("\n");

  // Mark as contacted so a repeat export later doesn't re-include these -
  // matches "export = about to send" intent. Skipped when previewing with
  // includeContacted=true.
  if (!includeContacted && deduped.length > 0) {
    const ids = deduped.map((r) => r.id);
    const CHUNK = 500;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { error: updateErr } = await admin
        .from("directory_listing")
        .update({ outreach_contacted_at: new Date().toISOString() })
        .in("id", chunk);
      if (updateErr) {
        console.error("[export-outreach-csv] failed to mark contacted for a chunk:", updateErr.message);
      }
    }
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="swiftscope-directory-outreach-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
