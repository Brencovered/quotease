/**
 * POST /api/admin/scrape
 * ----------------------
 * Unified scraper pipeline that replaces 6 separate Python scripts.
 * Now supports multiple trades per postcode scrape. AUSTRALIA-ONLY.
 *
 * 4-step pipeline per trade:
 *   1. Google Places Nearby Search (paginated, up to 60 results), hard
 *      radius-bounded around the postcode's geocoded centre point - the
 *      same postcode + radius model the /directory search page uses.
 *   2. Google Place Details per result (rating, phone, photos, website)
 *   3. Website scrape for email (mailto + regex) and logo (og:image, favicon, etc.)
 *   4. Supabase upsert into directory_listing table
 *
 * Body:  { trade: string | string[], postcode: string, radiusKm?: number }
 * Response: { success, postcode, radiusKm, tradesScraped, totalPlacesFound,
 *             totalEnriched, totalNew, totalUpdated, totalWithEmail,
 *             totalWithPhone, totalWithRating, totalWithLogo, perTrade[], results[] }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { geocodeAddress } from "@/lib/geocode";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScrapeRequest {
  trade: string | string[];
  postcode: string;
  radiusKm?: number;
}

interface GooglePlaceResult {
  place_id: string;
  name: string;
  // Nearby Search returns `vicinity` (a short address), not
  // `formatted_address` - the full address only comes back from the
  // Place Details call each result already gets in step 2, so this is
  // optional here and unused for AU-filtering (the hard radius already
  // guarantees that).
  formatted_address?: string;
  vicinity?: string;
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
  trade: string;
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
  trade: string;
}

interface PerTradeSummary {
  trade: string;
  placesFound: number;
  enriched: number;
  new: number;
  updated: number;
  withEmail: number;
  withPhone: number;
  withRating: number;
  withLogo: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const GOOGLE_NEARBY_URL =
  "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const GOOGLE_DETAILS_URL =
  "https://maps.googleapis.com/maps/api/place/details/json";

// Nearby Search's hard cap - requests above this are clamped.
const MAX_RADIUS_METRES = 50000;
const DEFAULT_RADIUS_KM = 15;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

const JUNK_EMAIL_PATTERNS = [
  /noreply/i, /no-reply/i, /donotreply/i, /example\.com/i,
  /sentry\.io/i, /wixpress\.com/i, /schema\.org/i,
  /\.(jpg|jpeg|png|gif|svg|webp|css|js)$/i,
];

/** Australian state codes */
const AU_STATES = ["VIC", "NSW", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

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
 * Returns { suburb: "", postcode: "" } for non-AU addresses.
 * Handles formats like: "123 Main St, Seaford VIC 3198, Australia"
 */
function parseAustralianAddress(address: string): { suburb: string; postcode: string; isAustralian: boolean } {
  // Check for Australian state code
  const hasAuState = AU_STATES.some((s) =>
    new RegExp(`\\b${s}\\b`, "i").test(address)
  );

  const statePattern = /,\s*([^,]+?)\s+(VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4})/i;
  const match = address.match(statePattern);
  if (match) {
    return { suburb: match[1].trim(), postcode: match[3], isAustralian: true };
  }

  // If no AU state found, mark as non-Australian
  if (!hasAuState) {
    return { suburb: "", postcode: "", isAustralian: false };
  }

  // Fallback: has AU state but no postcode match
  const postcodeFallback = address.match(/(\d{4})/);
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 2 && postcodeFallback) {
    return {
      suburb: parts[parts.length - 2].replace(/\s+\w+\s+\d{4}/, "").trim(),
      postcode: postcodeFallback[1],
      isAustralian: true,
    };
  }

  return { suburb: "", postcode: "", isAustralian: hasAuState };
}

function isValidEmail(email: string): boolean {
  if (!email || email.length < 5) return false;
  if (!email.includes("@")) return false;
  for (const pattern of JUNK_EMAIL_PATTERNS) {
    if (pattern.test(email)) return false;
  }
  return true;
}

function resolveUrl(url: string, base: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  try { return new URL(url, base).href; }
  catch { return `${base.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`; }
}

// ---------------------------------------------------------------------------
// Step 1: Google Places Nearby Search (paginated, up to 60 results),
// hard-bounded to radiusMetres around a lat/lng centre point - real
// geographic filtering, not a free-text suburb-name guess.
// ---------------------------------------------------------------------------

async function searchPlacesNearby(
  trade: string, centerLat: number, centerLng: number, radiusMetres: number
): Promise<GooglePlaceResult[]> {
  const results: GooglePlaceResult[] = [];
  let nextPageToken: string | undefined;

  for (let page = 0; page < 3; page++) {
    const params = new URLSearchParams({
      keyword: trade,
      location: `${centerLat},${centerLng}`,
      radius: String(Math.min(radiusMetres, MAX_RADIUS_METRES)),
      key: GOOGLE_API_KEY,
    });
    if (nextPageToken) params.set("pagetoken", nextPageToken);

    try {
      const res = await fetch(`${GOOGLE_NEARBY_URL}?${params.toString()}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) { console.error(`[scrape] Nearby search HTTP ${res.status}`); break; }

      const data = (await res.json()) as {
        results: GooglePlaceResult[];
        next_page_token?: string;
        status: string;
        error_message?: string;
      };

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.error(`[scrape] Places API error: ${data.status}`); break;
      }
      if (data.results?.length) results.push(...data.results);

      nextPageToken = data.next_page_token;
      if (!nextPageToken) break;
      await sleep(2000);
    } catch (err) {
      console.error("[scrape] Nearby search error:", err); break;
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Step 2: Fetch place details for a single place_id
// ---------------------------------------------------------------------------

async function fetchPlaceDetails(placeId: string): Promise<Partial<PlaceDetails> | null> {
  const fields = "rating,user_ratings_total,photos,formatted_phone_number,website,formatted_address";
  const url = `${GOOGLE_DETAILS_URL}?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: {
        rating?: number; user_ratings_total?: number;
        photos?: { photo_reference: string }[];
        formatted_phone_number?: string; website?: string;
        formatted_address?: string;
      }; status: string;
    };
    if (data.status !== "OK" || !data.result) return null;
    const r = data.result;
    return {
      rating: r.rating ?? null, reviewsCount: r.user_ratings_total ?? null,
      phone: r.formatted_phone_number ?? null, website: r.website ?? null,
      formattedAddress: r.formatted_address ?? "",
      photoReferences: (r.photos ?? []).slice(0, 6).map((p) => p.photo_reference),
    };
  } catch (err) {
    console.error(`[scrape] Place details error for ${placeId}:`, err); return null;
  }
}

// ---------------------------------------------------------------------------
// Step 3a: Scrape website for email
// ---------------------------------------------------------------------------

function extractEmails(html: string): string | null {
  const found = new Set<string>();

  // mailto: links
  const mailtoMatches = html.matchAll(/mailto:([^"'?\s]+)/gi);
  for (const m of mailtoMatches) {
    const email = decodeURIComponent(m[1]).trim().toLowerCase();
    if (isValidEmail(email)) found.add(email);
  }
  if (found.size > 0) return Array.from(found)[0];

  // Visible text
  const visibleText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  const regexMatches = visibleText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (regexMatches) {
    for (const email of regexMatches) {
      const clean = email.trim().toLowerCase();
      if (isValidEmail(clean)) found.add(clean);
    }
  }

  // data-email attributes
  const dataMatches = html.matchAll(/data-email="([^"]+)"/gi);
  for (const m of dataMatches) {
    const email = m[1].trim().toLowerCase();
    if (isValidEmail(email)) found.add(email);
  }

  return found.size > 0 ? Array.from(found)[0] : null;
}

// ---------------------------------------------------------------------------
// Step 3b: Scrape website for logo
// ---------------------------------------------------------------------------

// og:image is deliberately NOT used as a logo source -- it's meant for
// social-media link previews and is almost always a generic hero/content
// photo, not a logo. Using it here was exactly why a scraped business's
// "logo" would show a random banner photo (e.g. a hero shot from their
// homepage) instead of an actual brand mark, or Swiftscope's own
// "add your logo" placeholder if no real logo signal exists.
//
// Priority instead goes to actual logo signals, most to least direct:
//   1. an <img> whose src/alt literally says "logo"
//   2. apple-touch-icon (usually a square brand mark)
//   3. the page's favicon link tag
//   4. a guessed /favicon.ico as a last resort
export function extractLogoUrl(html: string, baseUrl: string): string | null {
  const logoImg = html.match(/<img[^>]+(?:src|alt)=["'][^"']*logo[^"']*["'][^>]*>/i);
  if (logoImg) {
    const srcMatch = logoImg[0].match(/src=["']([^"']+)["']/i);
    if (srcMatch) return resolveUrl(srcMatch[1], baseUrl);
  }

  const apple = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i);
  if (apple) return resolveUrl(apple[1], baseUrl);
  const appleRev = html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i);
  if (appleRev) return resolveUrl(appleRev[1], baseUrl);

  const favicon = html.match(/<link[^>]+rel=["']?(?:shortcut\s+)?icon["']?[^>]+href=["']([^"']+)["']/i);
  if (favicon) return resolveUrl(favicon[1], baseUrl);

  return resolveUrl("/favicon.ico", baseUrl);
}

// ---------------------------------------------------------------------------
// Fetch website HTML
// ---------------------------------------------------------------------------

export async function fetchWebsiteHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
      },
      signal: controller.signal, redirect: "follow",
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return null;
    return await res.text();
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[scrape] Website fetch error for ${url}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Run pipeline for a single trade
// ---------------------------------------------------------------------------

async function runTradeScrape(
  trade: string,
  postcode: string,
  centerLat: number,
  centerLng: number,
  radiusMetres: number,
  existingIds: Set<string>,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ results: ScrapeResultItem[]; summary: PerTradeSummary }> {
  console.log(`[scrape] --- ${trade} near postcode ${postcode} (${radiusMetres / 1000}km) ---`);

  // Step 1
  const searchResults = await searchPlacesNearby(trade, centerLat, centerLng, radiusMetres);
  console.log(`[scrape] ${trade}: found ${searchResults.length} places (raw)`);

  if (searchResults.length === 0) {
    return {
      results: [],
      summary: { trade, placesFound: 0, enriched: 0, new: 0, updated: 0, withEmail: 0, withPhone: 0, withRating: 0, withLogo: 0 },
    };
  }

  // Steps 2 + 3: enrich each place
  const enriched: PlaceDetails[] = [];
  let skippedNonAu = 0;

  for (const place of searchResults) {
    // Nearby Search is already hard-bounded to radiusMetres around an AU
    // postcode's centre point, so there's no free-text-search ambiguity
    // to pre-filter here (unlike the old "trade in suburb Australia" text
    // search, which could match places anywhere in the world with a
    // similarly-named suburb). The AU/suburb/postcode check happens once
    // Place Details returns the real formatted_address, below.
    const item: PlaceDetails = {
      placeId: place.place_id, name: place.name,
      formattedAddress: place.vicinity ?? place.formatted_address ?? "",
      // Fall back to the postcode we searched around - Place Details
      // (below) will normally overwrite this with the real, precise
      // suburb/postcode, but if that call ever fails we still want a
      // sane postcode on the record rather than leaving it blank.
      suburb: "", postcode: postcode,
      latitude: place.geometry?.location.lat ?? 0,
      longitude: place.geometry?.location.lng ?? 0,
      rating: null, reviewsCount: null, phone: null,
      website: null, photoReferences: [], email: null,
      logoUrl: null, status: "new", trade,
    };

    const details = await fetchPlaceDetails(place.place_id);
    if (!details || !details.formattedAddress) {
      // Couldn't get a real address to verify at all - previously this
      // silently kept the candidate with its placeholder suburb: ""
      // and the postcode we searched around, meaning a Place Details
      // failure (timeout, quota, bad place_id) was treated as "assume
      // Australian" instead of "couldn't verify." That's how US
      // businesses with a blank suburb (e.g. "Black Rock Roofing" across
      // half a dozen US states) ended up in an AU-only directory - not a
      // geographic radius bug, a silent-failure-defaults-to-accept bug.
      skippedNonAu++;
      console.log(`[scrape] Skipping unverifiable address: ${place.name}`);
      continue;
    }

    item.rating = details.rating ?? null;
    item.reviewsCount = details.reviewsCount ?? null;
    item.phone = details.phone ?? null;
    item.website = details.website ?? null;
    item.photoReferences = details.photoReferences ?? [];

    const upd = parseAustralianAddress(details.formattedAddress);
    if (!upd.isAustralian) {
      skippedNonAu++;
      console.log(`[scrape] Skipping non-AU (details): ${place.name}`);
      continue;
    }
    item.suburb = upd.suburb; item.postcode = upd.postcode;

    if (item.website) {
      const html = await fetchWebsiteHtml(item.website);
      if (html) {
        item.email = extractEmails(html);
        item.logoUrl = extractLogoUrl(html, item.website);
      }
    }

    enriched.push(item);
    await sleep(200);
  }

  if (skippedNonAu > 0) {
    console.log(`[scrape] ${trade}: skipped ${skippedNonAu} non-AU businesses`);
  }

  // Step 4: Supabase upsert
  const results: ScrapeResultItem[] = [];
  let newCount = 0, updatedCount = 0;

  for (const item of enriched) {
    const isExisting = existingIds.has(item.placeId);
    item.status = isExisting ? "updated" : "new";

    const { error: rpcErr } = await admin.rpc("upsert_directory_listing", {
      p_business_name: item.name, p_trades: [trade],
      p_website_url: item.website, p_suburb: item.suburb,
      p_postcode: item.postcode, p_latitude: item.latitude,
      p_longitude: item.longitude, p_place_id: item.placeId,
      p_google_rating: item.rating, p_google_reviews_count: item.reviewsCount,
      p_photo_references: item.photoReferences,
      p_scraped_contact_phone: item.phone,
      p_private_email: item.email, p_logo_url: item.logoUrl,
    });

    if (rpcErr) {
      const { error: fallbackErr } = await admin.from("directory_listing").upsert({
        business_name: item.name, trades: [trade], website_url: item.website,
        suburb: item.suburb, postcode: item.postcode, latitude: item.latitude,
        longitude: item.longitude, place_id: item.placeId,
        google_rating: item.rating, google_reviews_count: item.reviewsCount,
        photo_references: item.photoReferences,
        scraped_contact_phone: item.phone, private_email: item.email,
        logo_url: item.logoUrl, source: "scraper",
      }, { onConflict: "place_id" });
      if (fallbackErr) { console.error(`[scrape] Upsert failed:`, fallbackErr); continue; }
    }

    if (isExisting) updatedCount++;
    else { newCount++; existingIds.add(item.placeId); }

    results.push({
      placeId: item.placeId, name: item.name, suburb: item.suburb,
      rating: item.rating, reviewsCount: item.reviewsCount,
      phone: item.phone, email: item.email, logoUrl: item.logoUrl,
      website: item.website, status: item.status, trade,
    });
  }

  const summary: PerTradeSummary = {
    trade, placesFound: enriched.length, enriched: enriched.length,
    new: newCount, updated: updatedCount,
    withEmail: results.filter((r) => r.email).length,
    withPhone: results.filter((r) => r.phone).length,
    withRating: results.filter((r) => r.rating !== null).length,
    withLogo: results.filter((r) => r.logoUrl).length,
  };

  console.log(`[scrape] ${trade}: ${newCount} new, ${updatedCount} updated (${skippedNonAu} non-AU filtered)`);
  return { results, summary };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const startTime = Date.now();

  // Auth
  const authClient = await createClient();
  const { data: userData } = await authClient.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  // Parse body
  let body: ScrapeRequest;
  try { body = (await request.json()) as ScrapeRequest; }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const rawTrade = body.trade;
  const postcode = body.postcode?.trim();

  if (!rawTrade || !postcode) {
    return NextResponse.json({ error: "trade and postcode are required" }, { status: 400 });
  }
  if (!/^\d{4}$/.test(postcode)) {
    return NextResponse.json({ error: "postcode must be a 4-digit Australian postcode" }, { status: 400 });
  }

  const radiusKm = body.radiusKm && body.radiusKm > 0 ? body.radiusKm : DEFAULT_RADIUS_KM;
  const radiusMetres = Math.min(radiusKm * 1000, MAX_RADIUS_METRES);

  // Resolve the postcode to a centre point once - every trade in this
  // request searches around the same point. Same model as the
  // /directory search page: postcode -> geocode -> radius search.
  const center = await geocodeAddress(`${postcode} Australia`);
  if (!center) {
    return NextResponse.json({ error: `Could not resolve a location for postcode ${postcode}` }, { status: 400 });
  }

  // Normalise trades into array
  const trades: string[] = Array.isArray(rawTrade)
    ? rawTrade.map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [rawTrade.trim().toLowerCase()];

  if (trades.length === 0) {
    return NextResponse.json({ error: "At least one trade is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Load all existing place_ids once for deduplication across trades
  const { data: existingRows } = await admin
    .from("directory_listing")
    .select("place_id");
  const existingIds = new Set((existingRows ?? []).map((r) => r.place_id as string));

  // Run pipeline for each trade
  const allResults: ScrapeResultItem[] = [];
  const perTrade: PerTradeSummary[] = [];

  for (const trade of trades) {
    const { results, summary } = await runTradeScrape(trade, postcode, center.lat, center.lng, radiusMetres, existingIds, admin);
    allResults.push(...results);
    perTrade.push(summary);
  }

  // Aggregate
  const totalNew = perTrade.reduce((s, t) => s + t.new, 0);
  const totalUpdated = perTrade.reduce((s, t) => s + t.updated, 0);
  const duration = Date.now() - startTime;

  console.log(
    `[scrape] ALL DONE in ${duration}ms | ${trades.length} trades | ${allResults.length} AU results | ${totalNew} new | ${totalUpdated} updated`
  );

  return NextResponse.json({
    success: true,
    postcode,
    radiusKm,
    tradesScraped: trades.length,
    totalPlacesFound: perTrade.reduce((s, t) => s + t.placesFound, 0),
    totalEnriched: perTrade.reduce((s, t) => s + t.enriched, 0),
    totalNew,
    totalUpdated,
    totalWithEmail: perTrade.reduce((s, t) => s + t.withEmail, 0),
    totalWithPhone: perTrade.reduce((s, t) => s + t.withPhone, 0),
    totalWithRating: perTrade.reduce((s, t) => s + t.withRating, 0),
    totalWithLogo: perTrade.reduce((s, t) => s + t.withLogo, 0),
    durationMs: duration,
    perTrade,
    results: allResults,
  });
}
