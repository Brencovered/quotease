import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { findAndFetchGoogleListing } from "@/lib/googlePlaces";
import { scrapeWebsite } from "@/lib/websiteScrape";
import { tradeToSlug, suburbToSlug } from "@/lib/seo/meta";

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(
  query: any,
  params: { trade: string; email: string; phone: string; website: string; rating: string; search: string }
) {
  const { trade, email, phone, website, rating, search } = params;
  let q = query;

  if (trade) q = q.contains("trades", [trade]);

  if (email === "yes") q = q.or("scraped_contact_email.not.is.null,private_email.not.is.null");
  else if (email === "no") q = q.is("scraped_contact_email", null).is("private_email", null);

  if (phone === "yes") q = q.not("scraped_contact_phone", "is", null);
  else if (phone === "no") q = q.is("scraped_contact_phone", null);

  if (website === "yes") q = q.not("website_url", "is", null);
  else if (website === "no") q = q.is("website_url", null);

  if (rating === "yes") q = q.not("google_rating", "is", null);
  else if (rating === "no") q = q.is("google_rating", null);

  if (search) {
    const s = `%${search}%`;
    q = q.or(`business_name.ilike.${s},suburb.ilike.${s},scraped_contact_email.ilike.${s},website_url.ilike.${s}`);
  }

  return q;
}

const CSV_COLUMNS = [
  "business_name", "trades", "suburb", "postcode",
  "scraped_contact_email", "scraped_contact_phone", "private_email", "website_url",
  "google_rating", "google_reviews_count", "blurb", "place_id", "created_at",
] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = Array.isArray(value) ? value.join("; ") : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const unauthorised = await requireAdmin();
  if (unauthorised) return unauthorised;

  const { searchParams } = new URL(req.url);
  const trade = searchParams.get("trade") ?? "";
  const email = searchParams.get("email") ?? "";      // "yes" | "no" | ""
  const phone = searchParams.get("phone") ?? "";      // "yes" | "no" | ""
  const website = searchParams.get("website") ?? "";  // "yes" | "no" | ""
  const rating = searchParams.get("rating") ?? "";    // "yes" | "no" | ""
  const search = searchParams.get("search") ?? "";
  const format = searchParams.get("format") ?? "";

  const admin = createAdminClient();

  if (format === "csv") {
    // Export mode: same filters, but no 200-row UI cap -- the tradie picks
    // how many rows they want (up to a safety ceiling), and we page through
    // Supabase's own 1000-row-per-request limit internally to get there.
    const EXPORT_CEILING = 10000;
    const requested = searchParams.get("count") ?? "all";
    const wantCount = requested === "all" ? EXPORT_CEILING : Math.min(EXPORT_CEILING, Math.max(1, parseInt(requested, 10) || EXPORT_CEILING));

    const rows: Record<string, unknown>[] = [];
    const PAGE = 1000;
    for (let from = 0; rows.length < wantCount; from += PAGE) {
      const to = Math.min(from + PAGE, wantCount) - 1;
      let query = admin.from("directory_listing").select("*");
      query = applyFilters(query, { trade, email, phone, website, rating, search });
      const { data, error } = await query.order("created_at", { ascending: false }).range(from, to);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < to - from + 1) break;
    }

    const header = CSV_COLUMNS.join(",");
    const lines = rows.map((r) => CSV_COLUMNS.map((c) => csvEscape(r[c])).join(","));
    const csv = [header, ...lines].join("\n");
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="swiftscope-directory-${stamp}.csv"`,
      },
    });
  }

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(200, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10)));

  let query = admin.from("directory_listing").select("*", { count: "exact" });
  query = applyFilters(query, { trade, email, phone, website, rating, search });

  // Pagination
  const from = (page - 1) * limit;
  query = query.order("created_at", { ascending: false }).range(from, from + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ listings: data ?? [], total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  const unauthorised = await requireAdmin();
  if (unauthorised) return unauthorised;

  const body = await req.json();
  const business_name = (body.business_name ?? "").trim();
  const suburb = (body.suburb ?? "").trim() || null;
  let postcode = (body.postcode ?? "").trim() || null;
  const trades = Array.isArray(body.trades) ? body.trades.filter(Boolean) : [];
  const website_url = (body.website_url ?? "").trim() || null;
  const scraped_contact_email = (body.scraped_contact_email ?? "").trim() || null;
  const scraped_contact_phone = (body.scraped_contact_phone ?? "").trim() || null;
  const blurb = (body.blurb ?? "").trim() || null;

  if (!business_name) {
    return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // The scraper's search/filter and the directory's SEO pages both key
  // off postcode, not suburb text alone - same reason a manually-added
  // listing needs one too, not just a suburb name. If the admin didn't
  // type one in, back it out from whatever postcode other listings in
  // that suburb already use, rather than leaving it blank and having
  // this listing silently miss postcode-based search/pages.
  if (!postcode && suburb) {
    const { data: resolved } = await admin.rpc("resolve_postcode_for_suburb", { p_suburb: suburb });
    if (resolved) postcode = resolved as string;
  }

  // The scraper wouldn't otherwise touch this listing (that's the whole
  // reason it's being added manually), so pull the same rating/reviews/
  // photos data it would have gotten from Google, for this one business.
  const google = await findAndFetchGoogleListing(business_name, suburb);

  // Google Places lookup only works if the business actually has a
  // Google listing to find - a lot of the ones the scraper misses won't.
  // If the admin gave a website directly, scrape it the same way the
  // real scraper scrapes any website it finds, so email/logo still get
  // filled in even with zero Google presence.
  const websiteToScrape = website_url ?? google.website;
  const scraped = websiteToScrape ? await scrapeWebsite(websiteToScrape) : { email: null, logoUrl: null };

  const { data, error } = await admin
    .from("directory_listing")
    .insert({
      business_name,
      suburb,
      postcode,
      trades,
      website_url: websiteToScrape,
      scraped_contact_email: scraped_contact_email ?? scraped.email,
      scraped_contact_phone: scraped_contact_phone ?? google.formatted_phone_number,
      blurb,
      logo_url: scraped.logoUrl,
      source: "manual",
      place_id: google.place_id,
      google_rating: google.google_rating,
      google_reviews_count: google.google_reviews_count,
      photo_references: google.photo_references,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Set the page up the same way the weekly refresh-seo cron would for a
  // scraped listing, instead of leaving this trade+suburb's stats and
  // indexability stale until the next scheduled run (up to a week away).
  // Scoped to just this listing's trade(s)+suburb - not a full re-run of
  // the cron's all-listings scan, which stays untouched.
  if (suburb && trades.length > 0) {
    const suburbSlug = suburbToSlug(suburb);
    const state = "vic"; // matches refresh-seo's own hardcoding until directory_listing has a real state column
    const MIN_LISTINGS_FOR_INDEX = 3;

    for (const trade of trades) {
      try {
        const { data: rows } = await admin
          .from("directory_listing")
          .select("google_rating, google_reviews_count")
          .eq("suburb", suburb)
          .contains("trades", [trade]);

        let ratingSum = 0, ratingCount = 0, reviews = 0;
        for (const row of rows ?? []) {
          if (row.google_rating != null && (row.google_reviews_count ?? 0) >= 3) {
            ratingSum += Number(row.google_rating);
            ratingCount += 1;
          }
          reviews += row.google_reviews_count ?? 0;
        }
        const count = rows?.length ?? 0;

        await admin.from("trade_suburb_pages").upsert(
          {
            trade,
            suburb,
            suburb_slug: suburbSlug,
            state,
            listing_count: count,
            avg_rating: ratingCount > 0 ? ratingSum / ratingCount : null,
            total_reviews: reviews,
            is_indexed: count >= MIN_LISTINGS_FOR_INDEX,
            last_refreshed_at: new Date().toISOString(),
          },
          { onConflict: "trade,suburb_slug,state" }
        );

        revalidatePath(`/${tradeToSlug(trade)}-${suburbSlug}-${state}`);
      } catch (err) {
        console.error(`[admin/directory] SEO page setup failed for ${trade}/${suburb}:`, err);
        // A stats/revalidation hiccup shouldn't fail the listing creation
        // that already succeeded above - same posture as refresh-seo itself.
      }
    }
  }

  return NextResponse.json({ listing: data });
}

export async function PATCH(req: NextRequest) {
  const unauthorised = await requireAdmin();
  if (unauthorised) return unauthorised;

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Only allow specific fields to be updated
  const allowed = ["business_name", "trades", "website_url", "suburb", "postcode",
    "scraped_contact_email", "scraped_contact_phone", "private_email",
    "google_rating", "google_reviews_count", "blurb", "logo_url"];
  const clean: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) clean[key] = updates[key];
  }

  if (Object.keys(clean).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  clean.updated_at = new Date().toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("directory_listing")
    .update(clean)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ listing: data });
}

export async function DELETE(req: NextRequest) {
  const unauthorised = await requireAdmin();
  if (unauthorised) return unauthorised;

  const body = await req.json();
  const { ids } = body as { ids: string[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Missing ids array" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error, count } = await admin
    .from("directory_listing")
    .delete()
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: count ?? ids.length });
}
