import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  scrapeDirectoryPage,
  sanitizeSuburb,
} from "@/lib/directoryPageScrape";

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
  let skipped = 0;
  const errors: string[] = [];

  for (const listing of selected) {
    const name = listing.business_name!.trim();
    const suburb = sanitizeSuburb(listing.suburb);
    const website = (listing.website_url ?? listing.website)?.trim() || null;
    const email = listing.email?.trim() || null;
    const phone = listing.phone?.trim() || null;

    let already = false;
    if (suburb) {
      const { data: existing } = await admin
        .from("directory_listing")
        .select("id")
        .ilike("business_name", name)
        .ilike("suburb", suburb)
        .limit(1);
      already = Boolean(existing?.length);
    }
    if (!already && website) {
      const { data: bySite } = await admin
        .from("directory_listing")
        .select("id")
        .ilike("website_url", website)
        .limit(1);
      already = Boolean(bySite?.length);
    }
    if (already) {
      skipped++;
      continue;
    }

    const row: Record<string, unknown> = {
      business_name: name,
      suburb,
      postcode: listing.postcode?.trim() || null,
      state: listing.state?.trim() || null,
      website_url: website,
      scraped_contact_email: email,
      private_email: email,
      scraped_contact_phone: phone,
      source: "directory-page",
      is_claimed: false,
    };

    const { error } = await admin.from("directory_listing").insert(row);

    if (error) {
      errors.push(`${name}: ${error.message}`);
    } else {
      inserted++;
    }
  }

  return NextResponse.json({ inserted, skipped, errors });
}