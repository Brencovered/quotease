import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  scrapeDirectoryPage,
  sanitizeSuburb,
} from "@/lib/directoryPageScrape";
import { canonicalDirectorySource, DIRECTORY_SOURCE } from "@/lib/directoryIdentity";
import { upsertDirectoryListing } from "@/lib/directoryListingUpsert";

export const maxDuration = 60;

type ImportListing = {
  business_name?: string;
  suburb?: string | null;
  postcode?: string | null;
  state?: string | null;
  email?: string | null;
  website?: string | null;
  website_url?: string | null;
  phone?: string | null;
  source?: string | null;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    `admin-scrape-directory-page:${user.id}`,
    8,
    60 * 1000,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many scrape requests. Wait a minute and try again." },
      { status: 429 },
    );
  }

  let body: { url?: string; mode?: string; listings?: ImportListing[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.mode === "import") {
    return importListings(body.listings ?? []);
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "Enter a directory page URL." }, { status: 400 });
  }

  try {
    const result = await scrapeDirectoryPage(url);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    const status = /could not|invalid|enter a|no listings|no business/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function importListings(listings: ImportListing[]) {
  const selected = listings.filter((l) => l.business_name?.trim());
  if (selected.length === 0) {
    return NextResponse.json({ error: "No listings to import." }, { status: 400 });
  }

  const admin = createAdminClient();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const listing of selected) {
    const name = listing.business_name!.trim();
    const suburb = sanitizeSuburb(listing.suburb);
    const website = (listing.website_url ?? listing.website)?.trim() || null;
    const email = listing.email?.trim() || null;
    const phone = listing.phone?.trim() || null;
    const source = canonicalDirectorySource(listing.source, DIRECTORY_SOURCE.directoryHtml);

    try {
      const outcome = await upsertDirectoryListing(admin, {
        business_name: name,
        suburb,
        postcode: listing.postcode?.trim() || null,
        website_url: website,
        scraped_contact_email: email,
        private_email: email,
        scraped_contact_phone: phone,
        source,
        is_claimed: false,
      });
      if (outcome.action === "inserted") inserted++;
      else if (outcome.action === "updated") updated++;
      else {
        skipped++;
        if (outcome.conflict) errors.push(`${name}: ${outcome.conflict}`);
      }
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : "upsert failed"}`);
    }
  }

  return NextResponse.json({ inserted, updated, skipped, errors });
}