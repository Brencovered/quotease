/**
 * Parse a pasted Google Maps / Google Search / Yellow Pages (or similar)
 * directory results URL into business rows: name, suburb, email, website.
 *
 * Google result pages are JS-rendered, so those URLs are turned into a
 * Places Text Search query (GOOGLE_PLACES_API_KEY). Yellow Pages and other
 * HTML directories are fetched and parsed from JSON-LD plus listing cards.
 */

import { getRandomUserAgent } from "@/lib/websiteScraper";
import { scrapeWebsite } from "@/lib/websiteScrape";
import { formatPlacesApiError } from "@/lib/googlePlaces";

export type DirectoryPageSource = "google" | "yellowpages" | "html";

export interface DirectoryPageListing {
  business_name: string;
  suburb: string | null;
  postcode: string | null;
  state: string | null;
  email: string | null;
  website_url: string | null;
  phone: string | null;
  place_id: string | null;
  source: DirectoryPageSource;
}

const MAX_LISTINGS = 20;
const EMAIL_ENRICH_CAP = 12;

const JUNK_EMAIL = [
  /noreply/i, /no-reply/i, /example\.com/i, /sentry\.io/i, /schema\.org/i,
  /\.(jpg|jpeg|png|gif|svg|webp|css|js)$/i,
];

const CAPITAL_CITIES = /^(melbourne|sydney|brisbane|perth|adelaide|canberra|hobart|darwin)$/i;
const JUNK_BIZ_NAME = /^(yellow pages|google|true local|hipages)$/i;

function isDirectoryHostUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return (
      host.includes("yellowpages") ||
      host.includes("truelocal") ||
      host.includes("true-local") ||
      host.includes("hipages") ||
      host.includes("hotfrog") ||
      host.includes("startlocal") ||
      host === "google.com" ||
      host === "google.com.au" ||
      host.endsWith(".google.com") ||
      host.endsWith(".google.com.au") ||
      host === "goo.gl" ||
      host.endsWith(".goo.gl")
    );
  } catch {
    return true;
  }
}

export function isCapitalCitySuburb(suburb: string | null | undefined): boolean {
  return Boolean(suburb && CAPITAL_CITIES.test(suburb.trim()));
}

export function sanitizeSuburb(suburb: string | null | undefined): string | null {
  if (!suburb) return null;
  const trimmed = suburb.trim();
  if (!trimmed || isCapitalCitySuburb(trimmed)) return null;
  return trimmed;
}

export function detectDirectorySource(url: string): DirectoryPageSource {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (
      host === "google.com" ||
      host === "google.com.au" ||
      host.endsWith(".google.com") ||
      host.endsWith(".google.com.au") ||
      host === "maps.google.com" ||
      host === "maps.google.com.au" ||
      host === "maps.app.goo.gl" ||
      host === "goo.gl" ||
      host.endsWith(".goo.gl")
    ) {
      return "google";
    }
    if (host.includes("yellowpages")) return "yellowpages";
    return "html";
  } catch {
    return "html";
  }
}

/** Split "plumbers in Newtown NSW" into a Yellow Pages clue + location. */
export function splitTradeAndLocation(query: string): { clue: string; location: string } {
  const q = query.replace(/\s+/g, " ").trim();
  if (!q) return { clue: "", location: "" };

  const named = q.match(/^(.+?)\s+(?:in|near|around|at)\s+(.+)$/i);
  if (named) return { clue: named[1].trim(), location: named[2].trim() };

  const withState = q.match(/^(.*?)\s+(.+?\b(?:NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\b(?:\s+\d{4})?)$/i);
  if (withState && withState[1].trim().length >= 3) {
    return { clue: withState[1].trim(), location: withState[2].trim() };
  }

  const parts = q.split(" ");
  if (parts.length >= 2) {
    return { clue: parts.slice(0, -1).join(" "), location: parts[parts.length - 1] };
  }
  return { clue: q, location: "" };
}

export function yellowPagesSearchUrl(query: string): string {
  const { clue, location } = splitTradeAndLocation(query);
  const params = new URLSearchParams({ clue: clue || query });
  if (location) params.set("locationClue", location);
  return `https://www.yellowpages.com.au/search/listings?${params}`;
}

/** Pull the search text from a Google Maps / Search URL. */
export function googleQueryFromUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const q = url.searchParams.get("q") || url.searchParams.get("query") || url.searchParams.get("daddr");
  if (q && q.trim()) return decodePlus(q);

  const search = url.pathname.match(/\/maps\/search\/([^/@]+)/i);
  if (search?.[1]) return decodePlus(search[1]);

  const place = url.pathname.match(/\/maps\/place\/([^/@]+)/i);
  if (place?.[1]) return decodePlus(place[1]);

  return null;
}

function decodePlus(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, " ")).replace(/\s+/g, " ").trim();
}

export function suburbFromAuAddress(address: string | null | undefined): {
  suburb: string | null;
  postcode: string | null;
  state: string | null;
} {
  if (!address) return { suburb: null, postcode: null, state: null };
  const m = address.match(
    /,\s*([^,]+?)\s+(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\s+(\d{4})(?:\s*,\s*Australia)?/i,
  );
  if (m) {
    return { suburb: m[1].trim(), state: m[2].toUpperCase(), postcode: m[3] };
  }
  const pc = address.match(/\b(\d{4})\b/);
  const st = address.match(/\b(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\b/i);
  return {
    suburb: null,
    postcode: pc?.[1] ?? null,
    state: st?.[1]?.toUpperCase() ?? null,
  };
}

function isValidEmail(email: string): boolean {
  if (!email.includes("@") || email.length < 5) return false;
  return !JUNK_EMAIL.some((p) => p.test(email));
}

function emailFromHtml(html: string): string | null {
  const mailto = html.match(/mailto:([^"'?\s]+)/i);
  if (mailto) {
    const email = decodeURIComponent(mailto[1]).trim().toLowerCase();
    if (isValidEmail(email)) return email;
  }
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (match) {
    const email = match[0].trim().toLowerCase();
    if (isValidEmail(email)) return email;
  }
  return null;
}

function asArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o["@graph"])) return o["@graph"] as unknown[];
    if (Array.isArray(o.itemListElement)) return o.itemListElement as unknown[];
    return [data];
  }
  return [];
}

function listingFromJsonLd(item: Record<string, unknown>, source: DirectoryPageSource): DirectoryPageListing | null {
  const type = item["@type"];
  const typeStr = Array.isArray(type) ? type.join(" ") : String(type ?? "");
  const isBiz = /LocalBusiness|Plumber|Electrician|HomeAndConstructionBusiness|ProfessionalService|Organization/i.test(typeStr);
  if (!isBiz || /WebSite|WebPage|BreadcrumbList|SearchAction/i.test(typeStr)) return null;
  if (typeof item.name !== "string" || item.name.trim().length < 2) return null;
  if (JUNK_BIZ_NAME.test(item.name.trim())) return null;

  const addrRaw = item.address;
  const addr = addrRaw && typeof addrRaw === "object" ? (addrRaw as Record<string, unknown>) : {};
  const locality = typeof addr.addressLocality === "string" ? addr.addressLocality : null;
  const parsed = suburbFromAuAddress(
    [addr.streetAddress, locality, addr.addressRegion, addr.postalCode].filter(Boolean).join(", "),
  );

  let website: string | null = null;
  if (typeof item.url === "string") website = item.url;
  else if (typeof item.sameAs === "string") website = item.sameAs;
  else if (Array.isArray(item.sameAs) && typeof item.sameAs[0] === "string") website = item.sameAs[0];
  if (website && (!/^https?:/i.test(website) || isDirectoryHostUrl(website))) website = null;

  let email: string | null = typeof item.email === "string" ? item.email.toLowerCase() : null;
  if (email && !isValidEmail(email)) email = null;

  return {
    business_name: item.name.trim(),
    suburb: sanitizeSuburb(locality ?? parsed.suburb),
    postcode: typeof addr.postalCode === "string" ? addr.postalCode : parsed.postcode,
    state: typeof addr.addressRegion === "string" ? String(addr.addressRegion) : parsed.state,
    email,
    website_url: website ? website.split("?")[0] : null,
    phone: typeof item.telephone === "string" ? item.telephone : null,
    place_id: null,
    source,
  };
}

export function parseJsonLdListings(html: string, source: DirectoryPageSource): DirectoryPageListing[] {
  const out: DirectoryPageListing[] = [];
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]+?)<\/script>/gi);
  for (const block of blocks) {
    try {
      const data = JSON.parse(block[1]);
      for (const raw of asArray(data)) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as Record<string, unknown>;
        if (item.item && typeof item.item === "object") {
          const nested = listingFromJsonLd(item.item as Record<string, unknown>, source);
          if (nested) out.push(nested);
          continue;
        }
        const listing = listingFromJsonLd(item, source);
        if (listing) out.push(listing);
      }
    } catch {
      /* skip bad JSON-LD */
    }
  }
  return dedupeListings(out);
}

export function parseYellowPagesHtml(html: string): DirectoryPageListing[] {
  const fromLd = parseJsonLdListings(html, "yellowpages");
  if (fromLd.length > 0) return fromLd.slice(0, MAX_LISTINGS);

  const listings: DirectoryPageListing[] = [];
  const cards = html.matchAll(
    /<(?:div|article|li)[^>]*class=["'][^"']*(?:listing|result)[^"']*["'][^>]*>([\s\S]{80,4000}?)<\/(?:div|article|li)>/gi,
  );
  for (const card of cards) {
    const chunk = card[1];
    const nameMatch = chunk.match(/<(?:h[1-4]|a|strong)[^>]*>([\s\S]{2,120}?)<\/(?:h[1-4]|a|strong)>/i);
    if (!nameMatch) continue;
    const name = nameMatch[1].replace(/<[^>]+>/g, "").trim();
    if (name.length < 3) continue;

    const phoneMatch = chunk.match(/href=["']tel:([+\d\s\-().]{8,20})["']/i);
    const websiteMatch = chunk.match(/href=["'](https?:\/\/(?!(?:www\.)?(?:yellowpages|google))[^"']{10,})["']/i);
    const suburbMatch = chunk.match(/(?:suburb|locality)[^>]*>([^<]{3,40})</i)
      ?? chunk.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\s+(\d{4})\b/);
    const parsed = suburbFromAuAddress(chunk.replace(/<[^>]+>/g, " "));

    listings.push({
      business_name: name,
      suburb: sanitizeSuburb(suburbMatch && !suburbMatch[2] ? suburbMatch[1].trim() : parsed.suburb),
      postcode: suburbMatch?.[3] ?? parsed.postcode,
      state: suburbMatch?.[2] ?? parsed.state,
      email: emailFromHtml(chunk),
      website_url: websiteMatch && !isDirectoryHostUrl(websiteMatch[1])
        ? websiteMatch[1].split("?")[0]
        : null,
      phone: phoneMatch ? phoneMatch[1].trim() : null,
      place_id: null,
      source: "yellowpages",
    });
    if (listings.length >= MAX_LISTINGS) break;
  }
  return dedupeListings(listings);
}

function dedupeListings(rows: DirectoryPageListing[]): DirectoryPageListing[] {
  const seen = new Set<string>();
  const out: DirectoryPageListing[] = [];
  for (const row of rows) {
    const key = `${row.business_name.toLowerCase()}|${(row.suburb ?? "").toLowerCase()}|${(row.website_url ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function fetchHtml(url: string, referer?: string): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.8",
        ...(referer ? { Referer: referer } : {}),
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("json") && !ct.includes("application/xhtml")) {
      return await res.text();
    }
    return await res.text();
  } catch {
    clearTimeout(t);
    return null;
  }
}

async function googleTextSearch(query: string): Promise<DirectoryPageListing[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error("GOOGLE_PLACES_API_KEY is not set. Google directory URLs use Places Text Search.");
  }
  const params = new URLSearchParams({
    query,
    region: "au",
    key,
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`,
    { signal: AbortSignal.timeout(12000) },
  );
  if (!res.ok) throw new Error(`Google Places search failed (${res.status})`);
  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    results?: { place_id: string; name: string; formatted_address?: string; formatted_phone_number?: string }[];
  };
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(formatPlacesApiError(data.status, data.error_message));
  }
  const rows: DirectoryPageListing[] = [];
  for (const r of (data.results ?? []).slice(0, MAX_LISTINGS)) {
    const loc = suburbFromAuAddress(r.formatted_address);
    let website: string | null = null;
    let phone: string | null = r.formatted_phone_number ?? null;
    try {
      const detailsParams = new URLSearchParams({
        place_id: r.place_id,
        fields: "website,formatted_phone_number,formatted_address",
        key,
      });
      const detailsRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${detailsParams}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (detailsRes.ok) {
        const details = (await detailsRes.json()) as {
          result?: { website?: string; formatted_phone_number?: string; formatted_address?: string };
        };
        const rawSite = details.result?.website ?? null;
        website = rawSite && !isDirectoryHostUrl(rawSite) ? rawSite : null;
        phone = details.result?.formatted_phone_number ?? phone;
        if (details.result?.formatted_address) {
          const more = suburbFromAuAddress(details.result.formatted_address);
          loc.suburb = loc.suburb ?? more.suburb;
          loc.postcode = loc.postcode ?? more.postcode;
          loc.state = loc.state ?? more.state;
        }
      }
    } catch {
      /* keep text-search row */
    }
    rows.push({
      business_name: r.name,
      suburb: sanitizeSuburb(loc.suburb),
      postcode: loc.postcode,
      state: loc.state,
      email: null,
      website_url: website,
      phone,
      place_id: r.place_id,
      source: "google",
    });
  }
  return rows;
}

async function enrichEmails(rows: DirectoryPageListing[]): Promise<DirectoryPageListing[]> {
  let enriched = 0;
  const out: DirectoryPageListing[] = [];
  for (const row of rows) {
    if (row.email || !row.website_url || enriched >= EMAIL_ENRICH_CAP) {
      out.push(row);
      continue;
    }
    try {
      const scraped = await scrapeWebsite(row.website_url);
      out.push({ ...row, email: scraped.email });
      enriched += 1;
    } catch {
      out.push(row);
    }
  }
  return out;
}

async function resolveGoogleQuery(url: string): Promise<string | null> {
  const direct = googleQueryFromUrl(url);
  if (direct) return direct;

  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": getRandomUserAgent(), Accept: "text/html" },
      signal: AbortSignal.timeout(10000),
    });
    return googleQueryFromUrl(res.url);
  } catch {
    return null;
  }
}

async function tryGoogleTextSearch(query: string): Promise<DirectoryPageListing[]> {
  if (!process.env.GOOGLE_PLACES_API_KEY) return [];
  try {
    return await googleTextSearch(query);
  } catch {
    // Billing off, key blocked, quota, network: fall back to Yellow Pages.
    return [];
  }
}

async function scrapeYellowPagesForQuery(query: string): Promise<DirectoryPageListing[]> {
  const html = await fetchHtml(yellowPagesSearchUrl(query), "https://www.yellowpages.com.au/");
  if (!html) return [];
  return parseYellowPagesHtml(html).slice(0, MAX_LISTINGS);
}

export async function scrapeDirectoryPage(rawUrl: string): Promise<{
  source: DirectoryPageSource;
  query: string | null;
  listings: DirectoryPageListing[];
  note?: string;
}> {
  const url = rawUrl.trim().startsWith("http") ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  new URL(url); // throws if invalid
  const source = detectDirectorySource(url);

  if (source === "google") {
    const query = await resolveGoogleQuery(url);
    if (!query) {
      throw new Error("Could not read a search query from that Google URL. Use a Maps search or place link.");
    }

    const places = await tryGoogleTextSearch(query);
    const viaPlaces = places.length > 0;
    const listings = viaPlaces ? places : await scrapeYellowPagesForQuery(query);

    if (listings.length === 0) {
      throw new Error(
        `No listings for "${query}". Google result pages cannot be read directly, and Yellow Pages returned none. Paste a Yellow Pages search-results URL instead.`,
      );
    }

    return {
      source: viaPlaces ? "google" : "yellowpages",
      query,
      listings: await enrichEmails(listings),
      note: viaPlaces
        ? `Google result pages are JavaScript-rendered, so we ran Places Text Search for "${query}" and opened each business website for an email (up to ${EMAIL_ENRICH_CAP}).`
        : `Google pages are JavaScript-rendered and Places is not available (billing is off on that Google Cloud project), so we searched Yellow Pages for "${query}".`,
    };
  }

  const html = await fetchHtml(
    url,
    source === "yellowpages" ? "https://www.yellowpages.com.au/" : undefined,
  );
  if (!html) {
    throw new Error("Could not fetch that URL. The site may be down or blocking this server.");
  }

  const listings = source === "yellowpages"
    ? parseYellowPagesHtml(html)
    : parseJsonLdListings(html, "html").length
      ? parseJsonLdListings(html, "html")
      : parseYellowPagesHtml(html);

  if (listings.length === 0) {
    throw new Error(
      source === "yellowpages"
        ? "No listings found on that Yellow Pages page. The page may be login-walled or blocked. Try a search-results URL, not the homepage."
        : "No business listings found on that page. JSON-LD LocalBusiness data was empty.",
    );
  }

  const enriched = await enrichEmails(listings.slice(0, MAX_LISTINGS));
  const missingEmail = enriched.filter((l) => !l.email && l.website_url).length;
  return {
    source,
    query: null,
    listings: enriched,
    note: missingEmail
      ? `Opened up to ${EMAIL_ENRICH_CAP} business websites to find emails the directory did not show.`
      : undefined,
  };
}
