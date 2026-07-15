/**
 * Website scraping for a single, admin-provided URL - used by the manual
 * "Add tradie" flow when a business has little or no Google presence
 * (why it needed adding by hand in the first place) so Google Places
 * lookup has nothing to find.
 *
 * These are copies of the equivalent functions in
 * app/api/admin/scrape/route.ts (extractEmails, extractLogoUrl,
 * fetchWebsiteHtml, resolveUrl, isValidEmail, getRandomUserAgent), not a
 * refactor of it - same reasoning as lib/googlePlaces.ts: that route runs
 * the real, working, scheduled scrape pipeline; this is a single on-demand
 * fetch for one URL a human just typed in, and there's no reason to risk
 * the working pipeline to share this logic between them.
 */

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

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
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

function extractEmails(html: string): string | null {
  const found = new Set<string>();

  const mailtoMatches = html.matchAll(/mailto:([^"'?\s]+)/gi);
  for (const m of mailtoMatches) {
    const email = decodeURIComponent(m[1]).trim().toLowerCase();
    if (isValidEmail(email)) found.add(email);
  }
  if (found.size > 0) return Array.from(found)[0];

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

  const dataMatches = html.matchAll(/data-email="([^"]+)"/gi);
  for (const m of dataMatches) {
    const email = m[1].trim().toLowerCase();
    if (isValidEmail(email)) found.add(email);
  }

  return found.size > 0 ? Array.from(found)[0] : null;
}

function extractLogoUrl(html: string, baseUrl: string): string | null {
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImage) return resolveUrl(ogImage[1], baseUrl);
  const ogImageRev = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogImageRev) return resolveUrl(ogImageRev[1], baseUrl);

  const apple = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i);
  if (apple) return resolveUrl(apple[1], baseUrl);
  const appleRev = html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i);
  if (appleRev) return resolveUrl(appleRev[1], baseUrl);

  const logoImg = html.match(/<img[^>]+(?:src|alt)=["'][^"']*logo[^"']*["'][^>]*>/i);
  if (logoImg) {
    const srcMatch = logoImg[0].match(/src=["']([^"']+)["']/i);
    if (srcMatch) return resolveUrl(srcMatch[1], baseUrl);
  }

  const favicon = html.match(/<link[^>]+rel=["']?(?:shortcut\s+)?icon["']?[^>]+href=["']([^"']+)["']/i);
  if (favicon) return resolveUrl(favicon[1], baseUrl);

  return resolveUrl("/favicon.ico", baseUrl);
}

async function fetchWebsiteHtml(url: string): Promise<string | null> {
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
    console.error(`[websiteScrape] fetch error for ${url}:`, err);
    return null;
  }
}

export interface WebsiteScrapeResult {
  email: string | null;
  logoUrl: string | null;
}

/** Never throws - returns nulls if the URL is unreachable or unparseable. */
export async function scrapeWebsite(url: string): Promise<WebsiteScrapeResult> {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

  const html = await fetchWebsiteHtml(normalized);
  if (!html) return { email: null, logoUrl: null };

  return {
    email: extractEmails(html),
    logoUrl: extractLogoUrl(html, normalized),
  };
}
