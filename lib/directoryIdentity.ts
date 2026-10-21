/**
 * Normalised identity for directory_listing.
 *
 * Phones go through libphonenumber-js and are stored as E.164 (+61…).
 * Website identity is the hostname with a leading www stripped. Social
 * networks, directories, and supplier portals are not a business's own
 * site, so they do not become a website_domain and cannot collide on
 * the unique index.
 *
 * The SQL functions public.normalize_au_phone and
 * public.normalize_website_domain mirror these rules for the
 * BEFORE INSERT/UPDATE trigger. Keep the two in sync: the fixtures in
 * directoryIdentity.test.ts are the contract.
 */

import { parsePhoneNumberFromString } from "libphonenumber-js";

export const DIRECTORY_SOURCE = {
  googlePlaces: "google_places",
  yellowPages: "yellowpages",
  directoryHtml: "directory_html",
  websiteScrape: "website_scrape",
  abnBulk: "abn_bulk_extract",
  manual: "manual",
  selfSignup: "self_signup",
  claim: "claim",
} as const;

export type DirectorySource = (typeof DIRECTORY_SOURCE)[keyof typeof DIRECTORY_SOURCE];

/** Sources that mean "something scraped this" without saying what. */
const VAGUE_SOURCES = new Set(["scraper", "scraped", "directory-page"]);

/**
 * Hosts that many unrelated listings point at. Matching them as if they
 * were the business's own domain collapses franchises, suppliers, and
 * social profiles into one row.
 */
export const SHARED_WEBSITE_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "google.com",
  "google.com.au",
  "goo.gl",
  "yellowpages.com.au",
  "hipages.com.au",
  "truelocal.com.au",
  "hotfrog.com.au",
  "startlocal.com.au",
  "linktr.ee",
  "linktree.com",
  "bit.ly",
  "tinyurl.com",
  "reece.com.au",
  "beaumont-tiles.com.au",
  "actrol.com.au",
  "holcim.com.au",
  "tradehq.com.au",
  "servicetoday.com.au",
] as const;

export function normalizeAuPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, "AU");
  if (!parsed || !parsed.isValid() || parsed.country !== "AU") return null;
  return parsed.number;
}

/** 13 / 1300 / 1800 / 1900 numbers are shared call centres, not a single handset. */
export function isSharedAuServiceNumber(e164: string | null | undefined): boolean {
  if (!e164) return false;
  return /^\+6113\d{4}$/.test(e164) || /^\+611(?:300|800|900)\d{6}$/.test(e164);
}

export function normalizeAbn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\s+/g, "");
  return /^\d{11}$/.test(digits) ? digits : null;
}

function hostIsShared(host: string): boolean {
  return SHARED_WEBSITE_HOSTS.some((shared) => host === shared || host.endsWith(`.${shared}`));
}

export function normalizeWebsiteDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let cleaned = raw.trim();
  if (!cleaned) return null;
  if (!/^https?:\/\//i.test(cleaned)) cleaned = `https://${cleaned}`;

  let host: string;
  try {
    host = new URL(cleaned).hostname;
  } catch {
    return null;
  }
  host = host.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("www.")) host = host.slice(4);
  if (!host || !host.includes(".")) return null;
  if (hostIsShared(host)) return null;
  return host;
}

export function listingPhoneE164(row: {
  contact_phone?: string | null;
  scraped_contact_phone?: string | null;
}): string | null {
  return normalizeAuPhone(row.contact_phone) ?? normalizeAuPhone(row.scraped_contact_phone);
}

/**
 * Map a parser or legacy label onto the source stored on directory_listing.
 * Vague labels are replaced. An already-specific source is kept.
 */
export function canonicalDirectorySource(source: string | null | undefined, fallback: DirectorySource): string {
  const value = (source ?? "").trim().toLowerCase();
  switch (value) {
    case "google":
    case "google_places":
    case "scraper":
      return DIRECTORY_SOURCE.googlePlaces;
    case "yellowpages":
    case "yellow_pages":
      return DIRECTORY_SOURCE.yellowPages;
    case "html":
    case "directory_html":
    case "directory-page":
      return DIRECTORY_SOURCE.directoryHtml;
    case "website_scrape":
    case "website":
      return DIRECTORY_SOURCE.websiteScrape;
    case "abn_bulk_extract":
    case "abn":
      return DIRECTORY_SOURCE.abnBulk;
    case "self_signup":
      return DIRECTORY_SOURCE.selfSignup;
    case "claim":
      return DIRECTORY_SOURCE.claim;
    case "manual":
      return DIRECTORY_SOURCE.manual;
    default:
      return value && !VAGUE_SOURCES.has(value) ? value : fallback;
  }
}

/** Keep a specific historical source. Replace scraper / scraped / directory-page. */
export function mergeDirectorySource(existing: string | null | undefined, incoming: string): string {
  if (!existing || VAGUE_SOURCES.has(existing)) return incoming;
  return existing;
}

export function normalizeSuburbKey(suburb: string | null | undefined): string {
  return (suburb ?? "").trim().toLowerCase();
}
