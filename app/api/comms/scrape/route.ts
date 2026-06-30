import { NextResponse } from "next/server";

/**
 * Website scraper for tradie brochure content.
 * Extracts: business name, about text, services, testimonials, images.
 * No auth required - scraping public websites.
 */
export async function POST(request: Request) {
  const { url } = await request.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });
    }

    const html = await res.text();
    const baseUrl = new URL(url).origin;

    /* ---- Extract business name ---- */
    let businessName = "";
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const ogSiteMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogSiteMatch) businessName = ogSiteMatch[1].trim();
    else if (ogTitleMatch) businessName = ogTitleMatch[1].trim();
    else if (titleMatch) businessName = titleMatch[1].trim().split(/[|\-–]/)[0].trim();

    /* ---- Extract about text ---- */
    let about = "";
    // Look for about section
    const aboutPatterns = [
      /<section[^>]*(?:id|class)=["'][^"']*(?:about|who-we-are|our-story)[^"']*["'][^>]*>([\s\S]*?)<\/section>/i,
      /<div[^>]*(?:id|class)=["'][^"']*(?:about|who-we-are|our-story)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /<article[^>]*>([\s\S]*?)<\/article>/i,
    ];
    for (const pattern of aboutPatterns) {
      const match = html.match(pattern);
      if (match) {
        about = stripHtml(match[1]).slice(0, 800);
        if (about.length > 50) break;
      }
    }
    // Fallback: look for paragraph near "about us" heading
    if (about.length < 50) {
      const headingMatch = html.match(/<h[1-3][^>]*>[^<]*(?:about\s+us|who\s+we\s+are|our\s+story)[^<]*<\/h[1-3]>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
      if (headingMatch) about = stripHtml(headingMatch[1]).slice(0, 800);
    }

    /* ---- Extract services ---- */
    const services: string[] = [];
    const servicePatterns = [
      /<li[^>]*>([^<]*(?:electrical|plumb|roof|paint|tiling|landscap|fenc|carpen|handyman|renovat|repair|install|maintenance)[^<]*)<\/li>/gi,
      /<h[3-4][^>]*>([^<]*(?:service|specialty|what we do|our work)[^<]*)<\/h[3-4]>/gi,
    ];
    for (const pattern of servicePatterns) {
      let m;
      while ((m = pattern.exec(html)) !== null && services.length < 10) {
        const cleaned = stripHtml(m[1]).trim();
        if (cleaned.length > 3 && cleaned.length < 60 && !services.includes(cleaned)) {
          services.push(cleaned);
        }
      }
    }

    /* ---- Extract testimonials ---- */
    const testimonials: { text: string; author?: string }[] = [];
    const testimonialPatterns = [
      /<div[^>]*(?:class=["'][^"']*(?:testimonial|review)[^"']*["'])[^>]*>([\s\S]*?)<\/div>/gi,
      /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    ];
    for (const pattern of testimonialPatterns) {
      let m;
      while ((m = pattern.exec(html)) !== null && testimonials.length < 5) {
        const text = stripHtml(m[1]).trim();
        if (text.length > 20 && text.length < 400) {
          // Try to extract author
          const authorMatch = m[1].match(/<cite[^>]*>([^<]+)<\/cite>/i) || m[1].match(/<span[^>]*(?:class=["'][^"']*(?:author|name)[^"']*["'])[^>]*>([^<]+)<\/span>/i);
          testimonials.push({
            text: text.slice(0, 300),
            author: authorMatch ? stripHtml(authorMatch[1]).trim() : undefined,
          });
        }
      }
    }

    /* ---- Extract images ---- */
    const images: string[] = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null && images.length < 8) {
      let src = imgMatch[1];
      // Skip tiny icons, tracking pixels
      if (src.includes("icon") || src.includes("logo") || src.includes("pixel") || src.includes("tracking")) continue;
      if (src.startsWith("/")) src = baseUrl + src;
      if (src.startsWith("http") && !images.includes(src)) {
        images.push(src);
      }
    }
    // Also look for background images in CSS
    const bgRegex = /background-image:\s*url\(['"]?([^'"\)]+)['"]?\)/gi;
    let bgMatch;
    while ((bgMatch = bgRegex.exec(html)) !== null && images.length < 10) {
      let src = bgMatch[1];
      if (src.startsWith("/")) src = baseUrl + src;
      if (src.startsWith("http") && !images.includes(src)) {
        images.push(src);
      }
    }

    /* ---- Extract logo ---- */
    let logo = "";
    const logoPatterns = [
      /<img[^>]+(?:class=["'][^"']*(?:logo|brand)[^"']*["']|alt=["'][^"']*logo[^"']*["'])[^>]*src=["']([^"']+)["']/i,
      /<a[^>]*(?:class=["'][^"']*logo[^"']*["']|id=["']logo["'])[^>]*>\s*<img[^>]+src=["']([^"']+)["']/i,
    ];
    for (const pattern of logoPatterns) {
      const m = html.match(pattern);
      if (m) {
        logo = m[1].startsWith("/") ? baseUrl + m[1] : m[1];
        break;
      }
    }

    return NextResponse.json({
      businessName,
      about,
      services,
      testimonials,
      images,
      logo,
      url: baseUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
