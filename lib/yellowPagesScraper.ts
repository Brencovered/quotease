/**
 * lib/yellowPagesScraper.ts
 * ---------------------------
 * Core Yellow Pages scraping logic - fetch, parse, dedupe, insert.
 * Extracted from app/api/admin/scrape-yellowpages/route.ts (the manual
 * one-combo-at-a-time admin tool) so the same logic can also be driven
 * by lib/directoryExpansionSweep.ts (the automated sweep that works
 * through the full trade x location matrix on a schedule) without
 * duplicating it - one implementation, two callers.
 *
 * URL scheme and parsing rewritten after the original version returned
 * zero results across every combo run in production. Investigated
 * directly against the real site (not guessed): the original code hit
 * `/search/listings?clue=X&locationClue=Y`, which doesn't match Yellow
 * Pages' actual URL structure at all - real listing pages look like
 * `/melbourne-vic-3000/electrical-contractors?page=2`, and the site
 * doesn't embed LocalBusiness JSON-LD the way the original parser
 * assumed either. Category slugs also aren't just the trade name -
 * "electrician" is actually "electrical-contractors" on the real site.
 * See CATEGORY_SLUGS below; 13 of 15 confirmed directly against real
 * Yellow Pages URLs, painter and landscaper are reasonable inference
 * (consistent with the confirmed naming pattern) but not directly
 * verified - worth an early real-world check via the admin panel.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getRandomUserAgent } from "@/lib/websiteScraper";

const DELAY_MS = 1500; // be polite - don't hammer their servers
const RESULTS_PER_PAGE = 30; // confirmed from a real page: "Showing 1-30 of 1438"

/**
 * Trade -> Yellow Pages category slug. Confirmed directly against real
 * URLs (see comment above) except painter and landscaper, marked below.
 */
const CATEGORY_SLUGS: Record<string, string> = {
  electrician:      "electrical-contractors",
  plumber:          "plumbers-gasfitters",
  carpenter:        "carpenters-joiners",
  roofer:           "roofing-construction-services",
  painter:          "painters-decorators",       // inferred, not directly confirmed
  tiler:            "wall-floor-tilers",
  landscaper:       "landscape-gardeners",         // inferred, not directly confirmed
  builder:          "building-contractors",
  concreter:        "concrete-contractors",
  plasterer:        "plasterers",
  airconditioning:  "air-conditioning",
  solar:            "solar-energy",
  locksmith:        "locksmiths",
  glazier:          "glazier-glass-replacement-services",
  fencer:           "fencing-contractors",
};

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

export interface YellowPagesScrapeResult {
  found: number;
  inserted: number;
  skipped: number;
  pagesScraped: number;
  trade: string;
  suburb: string;
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
    if (!res.ok) {
      // Every prior "not working" report traced back to a real, fixable
      // cause once actually investigated (wrong URL scheme, missing
      // state) - but this function swallowed every failure completely
      // silently, so if the *next* failure is something else (bot
      // detection, a redirect, a block), there'd be no way to tell
      // without guessing again. Logging the real status/URL here means
      // Vercel runtime logs show exactly what happened next time.
      console.error(`[yellowPagesScraper] fetch failed: ${res.status} ${res.statusText} for ${url}`);
      return null;
    }
    const text = await res.text();
    if (text.length < 500) {
      console.error(`[yellowPagesScraper] suspiciously short response (${text.length} chars) for ${url}`);
    }
    return text;
  } catch (err) {
    clearTimeout(t);
    console.error(`[yellowPagesScraper] fetch threw for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function parseYPListings(html: string, trade: string): YPListing[] {
  const listings: YPListing[] = [];
  const seenUrls = new Set<string>();

  // Anchor on the one distinctive, reliable marker every real listing
  // has: a link to its business profile page, always shaped
  // /{suburb-slug}/bpp/{business-slug}-{numericId}. Confirmed directly
  // against real fetched pages - the business name is the link's own
  // text (`## [Business Name](.../bpp/...)` in the page's rendered
  // content), so no separate name-container regex is needed, and no
  // JSON-LD or specific wrapper class name has to be guessed at. Every
  // listing appears twice on a real page (once inline, once again in a
  // "Sponsored" section at the bottom) - seenUrls dedupes that.
  const profileLinks = html.matchAll(/<a[^>]+href=["']([^"']*\/bpp\/[a-z0-9-]+-\d+[^"']*)["'][^>]*>([\s\S]{2,120}?)<\/a>/gi);

  for (const m of profileLinks) {
    const url = m[1].split("?")[0];
    if (seenUrls.has(url)) continue;

    const name = m[2].replace(/<[^>]+>/g, "").trim();
    if (!name || name.length < 3 || name.length > 100) continue;
    // The same /bpp/ link is also used for non-heading elements (e.g.
    // wrapping a thumbnail image) - only the heading-text occurrence
    // gives a real business name, image-wrapping ones produce empty or
    // alt-text-only matches that this length/shape check filters out.
    if (/^(?:directions|more info|visit website)$/i.test(name)) continue;

    seenUrls.add(url);

    // Look at the window of text right after this listing's name for
    // its phone/address/website - confirmed from real pages that these
    // always appear in that order shortly after the name, regardless
    // of which wrapper element contains them.
    const afterIdx = m.index! + m[0].length;
    const window = html.slice(afterIdx, afterIdx + 1500);

    const phoneMatch = window.match(/href=["']tel:([^"']+)["']/i)
      ?? window.match(/\b((?:\(0\d\)\s?\d{4}\s?\d{4})|(?:1?[38]00\s?\d{3}\s?\d{3})|(?:04\d{2}\s?\d{3}\s?\d{3}))\b/);
    const websiteMatch = window.match(/href=["'](https?:\/\/(?!(?:www\.)?yellowpages)[^"']{10,})["'][^>]*>\s*(?:<[^>]+>\s*)*Visit Website/i);
    const addressMatch = window.match(/>([^<]{3,60}),\s*(NSW|VIC|QLD|WA|SA|TAS|NT|ACT),?\s*(\d{4})\b/i);
    const ratingMatch = window.match(/\b(\d\.\d)\s*\((\d+)\)/);

    listings.push({
      business_name: name,
      phone: phoneMatch ? phoneMatch[1].trim() : null,
      address: null,
      suburb: addressMatch ? addressMatch[1].trim() : null,
      postcode: addressMatch ? addressMatch[3] : null,
      state: addressMatch ? addressMatch[2].toUpperCase() : null,
      website_url: websiteMatch ? websiteMatch[1] : null,
      email: null,
      trade,
      source: "yellowpages",
      google_rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
      google_reviews_count: ratingMatch ? parseInt(ratingMatch[2]) : null,
    });
  }

  return listings.filter(l => l.business_name.length > 2);
}

const STATE_ABBREVIATIONS = ["nsw", "vic", "qld", "wa", "sa", "tas", "nt", "act"];

/**
 * Australia Post postcode ranges by state, used as a fallback when a
 * suburb string doesn't already include a state abbreviation. Real
 * incident this fixes: a custom trade+suburb entry of "Seaford" /
 * "3198" (state omitted) built the slug "seaford-3198" - missing the
 * "-vic-" the real site's URL scheme requires (confirmed pattern:
 * melbourne-vic-3000) - so the request 404'd and silently returned
 * zero results. The predefined trade x location matrix always
 * includes state in its suburb strings ("Melbourne VIC"), so this
 * only matters for free-text custom entries, but it's a real gap
 * worth closing rather than just telling people to type the state.
 * Ranges aren't perfectly precise at the boundaries (a handful of
 * postcodes are shared/contested between neighbouring states) but are
 * correct for the overwhelming majority and only used as a fallback
 * when the input didn't specify state anyway.
 */
function inferStateFromPostcode(postcode: string): string | null {
  const pc = parseInt(postcode, 10);
  if (isNaN(pc)) return null;
  if ((pc >= 1000 && pc <= 2599) || (pc >= 2620 && pc <= 2899) || (pc >= 2921 && pc <= 2999)) return "nsw";
  if (pc >= 200 && pc <= 299) return "act";
  if ((pc >= 2600 && pc <= 2619) || (pc >= 2900 && pc <= 2920)) return "act";
  if ((pc >= 3000 && pc <= 3999) || (pc >= 8000 && pc <= 8999)) return "vic";
  if ((pc >= 4000 && pc <= 4999) || (pc >= 9000 && pc <= 9999)) return "qld";
  if ((pc >= 5000 && pc <= 5999)) return "sa";
  if ((pc >= 6000 && pc <= 6999)) return "wa";
  if ((pc >= 7000 && pc <= 7999)) return "tas";
  if ((pc >= 800 && pc <= 999)) return "nt";
  return null;
}

function ypSearchUrl(trade: string, suburb: string, postcode: string, page = 1): string {
  const categorySlug = CATEGORY_SLUGS[trade.toLowerCase().trim()] ?? trade;
  // Real URL shape confirmed directly: /melbourne-vic-3000/electrical-contractors?page=2
  let locationSlug = suburb.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const hasState = STATE_ABBREVIATIONS.some(s => locationSlug.split("-").includes(s));
  if (!hasState && postcode) {
    const inferred = inferStateFromPostcode(postcode.trim());
    if (inferred) locationSlug += `-${inferred}`;
  }
  if (postcode) locationSlug += `-${postcode.trim()}`;

  const pageParam = page > 1 ? `?page=${page}` : "";
  return `https://www.yellowpages.com.au/${locationSlug}/${categorySlug}${pageParam}`;
}

export async function scrapeYellowPagesCombo(
  trade: string,
  suburb: string,
  postcode: string,
  pages: number,
  admin: ReturnType<typeof createAdminClient>
): Promise<YellowPagesScrapeResult> {
  const allListings: YPListing[] = [];
  let pagesScraped = 0;

  for (let page = 1; page <= Math.min(pages, 5); page++) {
    const url = ypSearchUrl(trade, suburb, postcode, page);
    const html = await fetchHtml(url);
    if (!html) {
      console.error(`[yellowPagesScraper] no HTML returned for ${url} - see fetch error above`);
      break;
    }

    const found = parseYPListings(html, trade);
    if (found.length === 0) {
      // Distinguishes "the network request failed" (logged above, in
      // fetchHtml) from "the page loaded fine but the parser found
      // nothing in it" - genuinely different problems needing
      // different fixes, and the only way to tell them apart from
      // outside is a log like this one.
      console.error(`[yellowPagesScraper] fetched ${html.length} chars from ${url} but parsed 0 listings - has /bpp/ link: ${html.includes("/bpp/")}`);
    }
    allListings.push(...found);
    pagesScraped++;

    if (found.length < RESULTS_PER_PAGE * 0.5) break; // probably last page
    if (page < pages) await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // Upsert into directory_listing (skip duplicates by business_name + suburb)
  let inserted = 0; let skipped = 0;
  for (const l of allListings) {
    if (!l.business_name || !l.suburb) { skipped++; continue; }

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
      state:                l.state ?? (suburb.match(/\b(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\b/)?.[0] ?? null),
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

  return {
    found: allListings.length,
    inserted, skipped,
    pagesScraped,
    trade, suburb,
  };
}
