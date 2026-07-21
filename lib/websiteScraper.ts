/**
 * Shared website scraping utilities used by both the Google scraper
 * and the website enrichment scraper.
 */

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function resolveUrl(path: string, base: string): string {
  if (!path) return "";
  try { return new URL(path, base).href; } catch { return ""; }
}

export async function fetchWebsiteHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":      getRandomUserAgent(),
        Accept:            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Connection:        "keep-alive",
      },
      signal: controller.signal, redirect: "follow",
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return null;
    return await res.text();
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export function extractLogoUrl(html: string, baseUrl: string): string | null {
  const logoImg = html.match(/<img[^>]+(?:src|alt)=[\"'][^\"']*logo[^\"']*[\"'][^>]*>/i);
  if (logoImg) {
    const srcMatch = logoImg[0].match(/src=[\"']([^\"']+)[\"']/i);
    if (srcMatch) return resolveUrl(srcMatch[1], baseUrl);
  }
  const apple = html.match(/<link[^>]+rel=[\"']apple-touch-icon[\"'][^>]+href=[\"']([^\"']+)[\"']/i)
    ?? html.match(/<link[^>]+href=[\"']([^\"']+)[\"'][^>]+rel=[\"']apple-touch-icon[\"']/i);
  if (apple) return resolveUrl(apple[1], baseUrl);
  const favicon = html.match(/<link[^>]+rel=[\"']?(?:shortcut\s+)?icon[\"']?[^>]+href=[\"']([^\"']+)[\"']/i);
  if (favicon) return resolveUrl(favicon[1], baseUrl);
  return resolveUrl("/favicon.ico", baseUrl);
}

export function extractBlurb(html: string): string | null {
  const desc = html.match(/<meta[^>]+name=[\"']description[\"'][^>]+content=[\"']([^\"']{20,300})[\"']/i)
    ?? html.match(/<meta[^>]+content=[\"']([^\"']{20,300})[\"'][^>]+name=[\"']description[\"']/i);
  if (desc) return desc[1].trim();
  const og = html.match(/<meta[^>]+property=[\"']og:description[\"'][^>]+content=[\"']([^\"']{20,300})[\"']/i);
  if (og) return og[1].trim();
  return null;
}

export function extractPhotos(html: string, baseUrl: string): string[] {
  const photos: string[] = [];
  const seen = new Set<string>();

  function add(url: string) {
    if (!url) return;
    const resolved = resolveUrl(url, baseUrl);
    if (!resolved || resolved.startsWith("data:")) return;
    if (/\.(svg|ico|gif)$/i.test(resolved)) return;
    if (/\/(icon|favicon|pixel|tracking|spacer|placeholder)/i.test(resolved)) return;
    if (seen.has(resolved)) return;
    seen.add(resolved);
    photos.push(resolved);
  }

  const og = html.match(/<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']/i)
    ?? html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:image[\"']/i);
  if (og) add(og[1]);

  const tw = html.match(/<meta[^>]+name=[\"']twitter:image[\"'][^>]+content=[\"']([^\"']+)[\"']/i);
  if (tw) add(tw[1]);

  const heroSection = html.match(/<(?:section|div)[^>]*(?:hero|banner|gallery|slider|carousel)[^>]*>([\s\S]{0,3000})/i);
  if (heroSection) {
    const imgMatches = heroSection[1].matchAll(/<img[^>]+src=[\"']([^\"']+)[\"'][^>]*>/gi);
    for (const m of imgMatches) add(m[1]);
  }

  const jsonLd = html.match(/<script[^>]+type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]+?)<\/script>/gi);
  if (jsonLd) {
    for (const block of jsonLd) {
      try {
        const data = JSON.parse(block.replace(/<[^>]+>/g, ""));
        const img = data.image ?? data["@graph"]?.[0]?.image;
        if (typeof img === "string") add(img);
        else if (Array.isArray(img)) img.slice(0, 3).forEach((i: string) => add(i));
      } catch {}
    }
  }

  return photos.slice(0, 6);
}

/**
 * Filter photos -- remove likely logo/icon images and dedupe against the logo URL.
 */
export function filterPhotos(photos: string[], logoUrl: string | null): string[] {
  return photos.filter(url => {
    if (!url) return false;
    // Skip if same as logo
    if (logoUrl && url === logoUrl) return false;
    // Skip filenames that look like logos/icons
    const lower = url.toLowerCase();
    if (/\/(logo|icon|brand|favicon|watermark|badge|seal)[^/]*\.(jpg|jpeg|png|webp)/.test(lower)) return false;
    // Skip very small images by URL hint (thumbnails)
    if (/[_-](thumb|thumbnail|small|xs|tiny|16x|32x|48x|64x|128x)/.test(lower)) return false;
    return true;
  });
}


/**
 * Extract about/company description from website HTML.
 * Looks for about page content, team descriptions, company history.
 * Returns up to 500 chars.
 */
export function extractAbout(html: string): string | null {
  // Look for about section by common selectors/patterns
  const aboutSection = html.match(
    /<(?:section|div)[^>]*(?:id|class)=["'][^"']*(?:about|who-we-are|our-story|company|team)[^"']*["'][^>]*>([\s\S]{50,2000}?)<\/(?:section|div)>/i
  );
  if (aboutSection) {
    const text = aboutSection[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 50) return text.slice(0, 500);
  }

  // Fallback: look for paragraphs near "about" heading
  const nearAbout = html.match(
    /<h[1-4][^>]*>[^<]*(?:about|who we are|our story)[^<]*<\/h[1-4]>\s*(?:<[^>]+>\s*)*<p[^>]*>([\s\S]{50,500}?)<\/p>/i
  );
  if (nearAbout) {
    const text = nearAbout[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text.length > 50) return text.slice(0, 500);
  }

  return null;
}

/**
 * Extract services list from website HTML.
 * Returns array of service strings (max 10).
 */
export function extractServices(html: string): string[] {
  const services: string[] = [];

  // Look for a services section with a list
  const serviceSection = html.match(
    /<(?:section|div)[^>]*(?:id|class)=["'][^"']*(?:services|what-we-do|specialties)[^"']*["'][^>]*>([\s\S]{50,3000}?)<\/(?:section|div)>/i
  );

  if (serviceSection) {
    const items = serviceSection[1].matchAll(/<li[^>]*>([\s\S]{5,100}?)<\/li>/gi);
    for (const m of items) {
      const text = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (text.length >= 5 && text.length <= 80) {
        services.push(text);
        if (services.length >= 10) break;
      }
    }
  }

  return services;
}

/**
 * Extract phone number from website HTML.
 */
export function extractPhone(html: string): string | null {
  // tel: links are most reliable
  const tel = html.match(/href=["']tel:([+\d\s\-().]{8,20})["']/i);
  if (tel) return tel[1].replace(/\s+/g, " ").trim();

  // AU mobile/landline patterns
  const auPhone = html.match(/((?:04|04\d\d|\(0[2-8]\)|\d{2})\s*[\d\s\-]{6,10}\d)/);
  if (auPhone) return auPhone[1].trim();

  return null;
}
