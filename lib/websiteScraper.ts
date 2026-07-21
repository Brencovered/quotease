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
