/**
 * POST /api/admin/scrape
 * ----------------------
 * Unified scraper pipeline that replaces 6 separate Python scripts.
 *
 * 4-step pipeline:
 *   1. Google Places Text Search (paginated, up to 60 results)
 *   2. Google Place Details per result (rating, phone, photos, website)
 *   3. Website scrape for email (mailto + regex) and logo (og:image, favicon, etc.)
 *   4. Supabase upsert into directory_listing table
 *
 * Body:  { trade: string, suburb: string }
 * Response: { success, trade, suburb, placesFound, enriched, new, updated,
 *             withEmail, withPhone, withRating, withLogo, results[] }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScrapeRequest {
  trade: string;
  suburb: string;
}

interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry?: {
    location: { lat: number; lng: number };
  };
  website?: string;
}

interface PlaceDetails {
  placeId: string;
  name: string;
  formattedAddress: string;
  suburb: string;
  postcode: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  reviewsCount: number | null;
  phone: string | null;
  website: string | null;
  photoReferences: string[];
  email: string | null;
  logoUrl: string | null;
  status: "new" | "updated";
}

interface ScrapeResultItem {
  placeId: string;
  name: string;
  suburb: string;
  rating: number | null;
  reviewsCount: number | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  website: string | null;
  status: "new" | "updated";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const GOOGLE_TEXTSEARCH_URL =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_DETAILS_URL =
  "https://maps.googleapis.com/maps/api/place/details/json";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

// Email patterns to exclude
const JUNK_EMAIL_PATTERNS = [
  /noreply/i,
  /no-reply/i,
  /donotreply/i,
  /example\.com/i,
  /sentry\.io/i,
  /wixpress\.com/i,
  /schema\.org/i,
  /\.(jpg|jpeg|png|gif|svg|webp|css|js)$/i,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Parse an Australian address into suburb and postcode.
 * Handles formats like: "123 Main St, Seaford VIC 3198, Australia"
 */
function parseAustralianAddress(
  address: string
): { suburb: string; postcode: string } {
  const suburb: string = "";
  const postcode: string = "";

  // Match: suburb + state + 4-digit postcode
  // Examples: "Seaford VIC 3198", "Bondi NSW 2026"
  const statePattern =
    /,\s*([^,]+?)\s+(VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4})/i;
  const match = address.match(statePattern);
  if (match) {
    return {
      suburb: match[1].trim(),
      postcode: match[3],
    };
  }

  // Fallback: look for any 4-digit postcode near the end
  const postcodeFallback = address.match(/(\d{4})/);
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 2 && postcodeFallback) {
    return {
      suburb: parts[parts.length - 2].replace(/\s+\w+\s+\d{4}/, "").trim(),
      postcode: postcodeFallback[1],
    };
  }

  return { suburb, postcode };
}

/**
 * Step 1: Google Places Text Search with pagination.
 * Returns up to 60 results (3 pages of 20).
 */
async function searchPlaces(trade: string, suburb: string): Promise<GooglePlaceResult[]> {
  const results: GooglePlaceResult[] = [];
  let nextPageToken: string | undefined;
  const pages = 3; // Google allows max 3 pages (60 results)

  for (let page = 0; page < pages; page++) {
    const params = new URLSearchParams({
      query: `${trade} in ${suburb}`,
      key: GOOGLE_API_KEY,
    });
    if (nextPageToken) {
      params.set("pagetoken", nextPageToken);
    }

    const url = `${GOOGLE_TEXTSEARCH_URL}?${params.toString()}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        console.error(`[scrape] Text search HTTP ${res.status}: ${await res.text()}`);
        break;
      }

      const data = (await res.json()) as {
        results: GooglePlaceResult[];
        next_page_token?: string;
        status: string;
        error_message?: string;
      };

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.error(`[scrape] Places API error: ${data.status} - ${data.error_message ?? ""}`);
        break;
      }

      if (data.results && data.results.length > 0) {
        results.push(...data.results);
      }

      nextPageToken = data.next_page_token;

      // If no next page, we're done
      if (!nextPageToken) break;

      // Google requires a delay before using the next page token
      await sleep(2000);
    } catch (err) {
      console.error("[scrape] Text search error:", err);
      break;
    }
  }

  return results;
}

/**
 * Step 2: Fetch place details for a single place_id.
 */
async function fetchPlaceDetails(
  placeId: string
): Promise<Partial<PlaceDetails> | null> {
  const fields = [
    "rating",
    "user_ratings_total",
    "photos",
    "formatted_phone_number",
    "website",
    "formatted_address",
  ].join(",");

  const url = `${GOOGLE_DETAILS_URL}?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      result?: {
        rating?: number;
        user_ratings_total?: number;
        photos?: { photo_reference: string }[];
        formatted_phone_number?: string;
        website?: string;
        formatted_address?: string;
      };
      status: string;
    };

    if (data.status !== "OK" || !data.result) return null;

    const r = data.result;

    return {
      rating: r.rating ?? null,
      reviewsCount: r.user_ratings_total ?? null,
      phone: r.formatted_phone_number ?? null,
      website: r.website ?? null,
      formattedAddress: r.formatted_address ?? "",
      photoReferences: (r.photos ?? [])
        .slice(0, 6)
        .map((p) => p.photo_reference),
    };
  } catch (err) {
    console.error(`[scrape] Place details error for ${placeId}:`, err);
    return null;
  }
}

/**
 * Step 3a: Scrape a website for email addresses.
 * Priority: mailto: links > regex in visible text.
 */
function extractEmails(html: string, baseUrl: string): string | null {
  const found = new Set<string>();

  // 1. Look for mailto: links (most reliable)
  const mailtoMatches = html.matchAll(/mailto:([^"'?\s]+)/gi);
  for (const m of mailtoMatches) {
    const email = decodeURIComponent(m[1]).trim().toLowerCase();
    if (isValidEmail(email)) found.add(email);
  }

  if (found.size > 0) {
    return Array.from(found)[0];
  }

  // 2. Strip HTML tags to get visible text
  const visibleText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  // 3. Regex scan in visible text
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const regexMatches = visibleText.match(emailRegex);
  if (regexMatches) {
    for (const email of regexMatches) {
      const clean = email.trim().toLowerCase();
      if (isValidEmail(clean)) found.add(clean);
    }
  }

  // 4. Check for emails in common obfuscation patterns
  // data-email, data-contact, etc.
  const dataEmailMatches = html.matchAll(/data-email="([^"]+)"/gi);
  for (const m of dataEmailMatches) {
    const email = m[1].trim().toLowerCase();
    if (isValidEmail(email)) found.add(email);
  }

  return found.size > 0 ? Array.from(found)[0] : null;
}

/**
 * Validate an email is not junk.
 */
function isValidEmail(email: string): boolean {
  if (!email || email.length < 5) return false;
  if (!email.includes("@")) return false;

  for (const pattern of JUNK_EMAIL_PATTERNS) {
    if (pattern.test(email)) return false;
  }

  return true;
}

/**
 * Step 3b: Scrape a website for a logo URL.
 * Priority: og:image > apple-touch-icon > img[logo] > favicon.
 */
function extractLogoUrl(html: string, baseUrl: string): string | null {
  // 1. og:image meta tag
  const ogImage = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  );
  if (ogImage) return resolveUrl(ogImage[1], baseUrl);

  const ogImageReverse = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
  );
  if (ogImageReverse) return resolveUrl(ogImageReverse[1], baseUrl);

  // 2. apple-touch-icon
  const appleIcon = html.match(
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i
  );
  if (appleIcon) return resolveUrl(appleIcon[1], baseUrl);

  const appleIconReverse = html.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i
  );
  if (appleIconReverse) return resolveUrl(appleIconReverse[1], baseUrl);

  // 3. apple-touch-icon-precomposed
  const appleIconPre = html.match(
    /<link[^>]+rel=["']apple-touch-icon-precomposed["'][^>]+href=["']([^"']+)["']/i
  );
  if (appleIconPre) return resolveUrl(appleIconPre[1], baseUrl);

  // 4. Image with "logo" in src or alt
  const logoImg = html.match(
    /<img[^>]+(?:src|alt)=["'][^"']*logo[^"']*["'][^>]*>/i
  );
  if (logoImg) {
    const srcMatch = logoImg[0].match(/src=["']([^"']+)["']/i);
    if (srcMatch) return resolveUrl(srcMatch[1], baseUrl);
  }

  // 5. Favicon
  const favicon = html.match(
    /<link[^>]+rel=["']?(?:shortcut\s+)?icon["']?[^>]+href=["']([^"']+)["']/i
  );
  if (favicon) return resolveUrl(favicon[1], baseUrl);

  const faviconReverse = html.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']?(?:shortcut\s+)?icon["']?/i
  );
  if (faviconReverse) return resolveUrl(faviconReverse[1], baseUrl);

  // 6. Default /favicon.ico
  return resolveUrl("/favicon.ico", baseUrl);
}

/**
 * Resolve a potentially relative URL against a base URL.
 */
function resolveUrl(url: string, base: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  try {
    return new URL(url, base).href;
  } catch {
    return `${base.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
  }
}

/**
 * Fetch website HTML with timeout and retry.
 */
async function fetchWebsiteHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    return await res.text();
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error).name === "AbortError") {
      console.error(`[scrape] Website fetch timed out: ${url}`);
    } else {
      console.error(`[scrape] Website fetch error for ${url}:`, err);
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const startTime = Date.now();

  // --- Auth check ----------------------------------------------------------
  const authClient = await createClient();
  const { data: userData } = await authClient.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  // --- Parse body ----------------------------------------------------------
  let body: ScrapeRequest;
  try {
    body = (await request.json()) as ScrapeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { trade, suburb } = body;
  if (!trade || typeof trade !== "string" || !suburb || typeof suburb !== "string") {
    return NextResponse.json(
      { error: "trade and suburb are required strings" },
      { status: 400 }
    );
  }

  const normalisedTrade = trade.trim().toLowerCase();
  const normalisedSuburb = suburb.trim();

  // --- Step 1: Google Places Text Search ----------------------------------
  console.log(`[scrape] Starting search: "${normalisedTrade} in ${normalisedSuburb}"`);
  const places = await searchPlaces(normalisedTrade, normalisedSuburb);
  console.log(`[scrape] Found ${places.length} places`);

  if (places.length === 0) {
    return NextResponse.json({
      success: true,
      trade: normalisedTrade,
      suburb: normalisedSuburb,
      placesFound: 0,
      enriched: 0,
      new: 0,
      updated: 0,
      withEmail: 0,
      withPhone: 0,
      withRating: 0,
      withLogo: 0,
      results: [],
    });
  }

  // --- Step 2 + 3: Enrich each place --------------------------------------
  const enriched: PlaceDetails[] = [];

  for (const place of places) {
    const addressParts = parseAustralianAddress(place.formatted_address);

    const enrichedItem: PlaceDetails = {
      placeId: place.place_id,
      name: place.name,
      formattedAddress: place.formatted_address,
      suburb: addressParts.suburb,
      postcode: addressParts.postcode,
      latitude: place.geometry?.location.lat ?? 0,
      longitude: place.geometry?.location.lng ?? 0,
      rating: null,
      reviewsCount: null,
      phone: null,
      website: null,
      photoReferences: [],
      email: null,
      logoUrl: null,
      status: "new",
    };

    // Step 2: Place Details
    const details = await fetchPlaceDetails(place.place_id);
    if (details) {
      enrichedItem.rating = details.rating ?? null;
      enrichedItem.reviewsCount = details.reviewsCount ?? null;
      enrichedItem.phone = details.phone ?? null;
      enrichedItem.website = details.website ?? null;
      enrichedItem.photoReferences = details.photoReferences ?? [];

      // Update address from details if available
      if (details.formattedAddress) {
        enrichedItem.formattedAddress = details.formattedAddress;
        const updatedParts = parseAustralianAddress(details.formattedAddress);
        enrichedItem.suburb = updatedParts.suburb;
        enrichedItem.postcode = updatedParts.postcode;
      }
    }

    // Step 3: Website scrape for email + logo
    if (enrichedItem.website) {
      const html = await fetchWebsiteHtml(enrichedItem.website);
      if (html) {
        enrichedItem.email = extractEmails(html, enrichedItem.website);
        enrichedItem.logoUrl = extractLogoUrl(html, enrichedItem.website);
      }
    }

    enriched.push(enrichedItem);

    // Rate limit: 200ms between each place
    await sleep(200);
  }

  // --- Step 4: Supabase upsert --------------------------------------------
  const admin = createAdminClient();

  // Check which place_ids already exist
  const placeIds = enriched.map((e) => e.placeId);
  const { data: existingRows } = await admin
    .from("directory_listing")
    .select("place_id")
    .in("place_id", placeIds);

  const existingIds = new Set((existingRows ?? []).map((r) => r.place_id));

  let newCount = 0;
  let updatedCount = 0;
  const results: ScrapeResultItem[] = [];

  for (const item of enriched) {
    const isExisting = existingIds.has(item.placeId);
    item.status = isExisting ? "updated" : "new";

    // Upsert via raw SQL for the ON CONFLICT logic with COALESCE
    const { error: upsertError } = await admin.rpc("upsert_directory_listing", {
      p_business_name: item.name,
      p_trades: [normalisedTrade],
      p_website_url: item.website,
      p_suburb: item.suburb,
      p_postcode: item.postcode,
      p_latitude: item.latitude,
      p_longitude: item.longitude,
      p_place_id: item.placeId,
      p_google_rating: item.rating,
      p_google_reviews_count: item.reviewsCount,
      p_photo_references: item.photoReferences,
      p_scraped_contact_phone: item.phone,
      p_private_email: item.email,
      p_logo_url: item.logoUrl,
    });

    // Fallback: if RPC doesn't exist, use standard upsert
    if (upsertError) {
      console.error("[scrape] RPC upsert failed, trying standard upsert:", upsertError.message);

      const { error: fallbackError } = await admin
        .from("directory_listing")
        .upsert(
          {
            business_name: item.name,
            trades: [normalisedTrade],
            website_url: item.website,
            suburb: item.suburb,
            postcode: item.postcode,
            latitude: item.latitude,
            longitude: item.longitude,
            place_id: item.placeId,
            google_rating: item.rating,
            google_reviews_count: item.reviewsCount,
            photo_references: item.photoReferences,
            scraped_contact_phone: item.phone,
            private_email: item.email,
            logo_url: item.logoUrl,
            source: "scraper",
          },
          { onConflict: "place_id" }
        );

      if (fallbackError) {
        console.error(`[scrape] Upsert failed for ${item.placeId}:`, fallbackError);
        continue;
      }
    }

    if (isExisting) {
      updatedCount++;
    } else {
      newCount++;
      existingIds.add(item.placeId); // Prevent double-counting
    }

    results.push({
      placeId: item.placeId,
      name: item.name,
      suburb: item.suburb,
      rating: item.rating,
      reviewsCount: item.reviewsCount,
      phone: item.phone,
      email: item.email,
      logoUrl: item.logoUrl,
      website: item.website,
      status: item.status,
    });
  }

  // --- Build response ------------------------------------------------------
  const withEmail = results.filter((r) => r.email).length;
  const withPhone = results.filter((r) => r.phone).length;
  const withRating = results.filter((r) => r.rating !== null).length;
  const withLogo = results.filter((r) => r.logoUrl).length;
  const duration = Date.now() - startTime;

  console.log(
    `[scrape] Completed in ${duration}ms | Found: ${places.length} | New: ${newCount} | Updated: ${updatedCount} | Email: ${withEmail} | Phone: ${withPhone} | Rating: ${withRating} | Logo: ${withLogo}`
  );

  return NextResponse.json({
    success: true,
    trade: normalisedTrade,
    suburb: normalisedSuburb,
    placesFound: places.length,
    enriched: enriched.length,
    new: newCount,
    updated: updatedCount,
    withEmail,
    withPhone,
    withRating,
    withLogo,
    durationMs: duration,
    results,
  });
}
