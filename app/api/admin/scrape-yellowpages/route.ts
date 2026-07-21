import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { getRandomUserAgent, resolveUrl } from "@/lib/websiteScraper";

const DELAY_MS = 1500; // be polite -- don't hammer their servers
const RESULTS_PER_PAGE = 20;

interface YPListing {
  business_name:     string;
  phone:             string | null;
  address:           string | null;
  suburb:            string | null;
  postcode:          string | null;
  state:             string | null;
  website_url:       string | null;
  email:             string | null;
  trade:             string;
  source:            string;
  google_rating:     number | null;
  google_reviews_count: number | null;
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.yellowpages.com.au/",
        Connection: "keep-alive",
      },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    clearTimeout(t);
    return null;
  }
}

function parseYPListings(html: string, trade: string): YPListing[] {
  const listings: YPListing[] = [];

  // YP listing cards -- each has class "listing-item" or similar
  // Extract JSON-LD structured data first (most reliable)
  const jsonLdBlocks = html.matchAll(/<script[^>]+type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]+?)<\/script>/gi);
  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block[1]);
      const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const item of items) {
        if (!item["@type"]?.includes?.("LocalBusiness") && item["@type"] !== "LocalBusiness") continue;
        const addr = item.address ?? {};
        listings.push({
          business_name: item.name ?? "",
          phone: item.telephone ?? null,
          address: item.streetAddress ?? addr.streetAddress ?? null,
          suburb: addr.addressLocality ?? null,
          postcode: addr.postalCode ?? null,
          state: addr.addressRegion ?? null,
          website_url: item.url ?? item.sameAs ?? null,
          email: item.email ?? null,
          trade,
          source: "yellowpages",
          google_rating: item.aggregateRating?.ratingValue ? parseFloat(item.aggregateRating.ratingValue) : null,
          google_reviews_count: item.aggregateRating?.reviewCount ? parseInt(item.aggregateRating.reviewCount) : null,
        });
      }
    } catch {}
  }

  // Fallback: parse HTML listing cards if JSON-LD yielded nothing
  if (listings.length === 0) {
    const cards = html.matchAll(/<(?:div|li)[^>]*class=[\"'][^\"']*listing[^\"']*[\"'][^>]*>([\s\S]{100,2000}?)<\/(?:div|li)>/gi);
    for (const card of cards) {
      const html = card[1];

      const nameMatch = html.match(/<(?:h[1-4]|strong)[^>]*>([\s\S]{2,100}?)<\/(?:h[1-4]|strong)>/i);
      const phoneMatch = html.match(/href=[\"']tel:([+\d\s\-().]{8,20})[\"']/i);
      const websiteMatch = html.match(/href=[\"'](https?:\/\/(?!(?:www\.)?yellowpages)[^\"']{10,})[\"']/i);
      const suburbMatch = html.match(/(?:suburb|locality)[^>]*>([^<]{3,40})<\//i);

      if (!nameMatch) continue;
      const name = nameMatch[1].replace(/<[^>]+>/g, "").trim();
      if (!name || name.length < 3) continue;

      listings.push({
        business_name: name,
        phone: phoneMatch ? phoneMatch[1].trim() : null,
        address: null, suburb: suburbMatch ? suburbMatch[1].trim() : null,
        postcode: null, state: null,
        website_url: websiteMatch ? websiteMatch[1] : null,
        email: null, trade, source: "yellowpages",
        google_rating: null, google_reviews_count: null,
      });
    }
  }

  return listings.filter(l => l.business_name.length > 2);
}

function ypSearchUrl(trade: string, suburb: string, postcode: string, page = 1): string {
  const q   = encodeURIComponent(trade);
  // Postcode gives more precise results than suburb name
  const loc = encodeURIComponent(postcode || suburb);
  const start = (page - 1) * RESULTS_PER_PAGE;
  return `https://www.yellowpages.com.au/search/listings?clue=${q}&locationClue=${loc}&start=${start}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { trade = "electrician", suburb = "Sydney NSW", postcode = "", pages = 2 } = body;

  const admin = createAdminClient();
  const allListings: YPListing[] = [];
  let pagesScraped = 0;

  for (let page = 1; page <= Math.min(pages, 5); page++) {
    const url = ypSearchUrl(trade, suburb, postcode, page);
    const html = await fetchHtml(url);
    if (!html) break;

    const found = parseYPListings(html, trade);
    allListings.push(...found);
    pagesScraped++;

    if (found.length < RESULTS_PER_PAGE * 0.5) break; // probably last page
    if (page < pages) await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // Upsert into directory_listing (skip duplicates by business_name + suburb)
  let inserted = 0; let skipped = 0;
  for (const l of allListings) {
    if (!l.business_name || !l.suburb) { skipped++; continue; }

    // Check if already exists
    const { data: existing } = await admin
      .from("directory_listing")
      .select("id")
      .ilike("business_name", l.business_name)
      .ilike("suburb", l.suburb ?? "")
      .limit(1);

    if (existing?.length) { skipped++; continue; }

    const { error } = await admin.from("directory_listing").insert({
      business_name:        l.business_name,
      trades:               [l.trade],
      suburb:               l.suburb,
      postcode:             l.postcode || postcode || null,
      state:                l.state ?? (suburb.match(/(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)/)?.[0] ?? null),
      scraped_contact_phone: l.phone,
      private_email:        l.email,
      website_url:          l.website_url,
      google_rating:        l.google_rating,
      google_reviews_count: l.google_reviews_count,
      source:               "yellowpages",
      is_claimed:           false,
    });

    if (!error) inserted++;
    else skipped++;
  }

  return NextResponse.json({
    found: allListings.length,
    inserted, skipped,
    pagesScraped,
    trade, suburb,
  });
}
