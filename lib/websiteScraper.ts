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

// Every text-extraction function below strips tags but never decoded HTML
// entities - "Design &amp; Planning" was showing up verbatim as literal
// text instead of "Design & Planning". Covers the handful of entities that
// actually show up in real page copy (not attempting a full HTML entity
// table - ampersand, quotes, and numeric entities cover the practical
// cases).
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
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
  if (desc) return decodeHtmlEntities(desc[1].trim());
  const og = html.match(/<meta[^>]+property=[\"']og:description[\"'][^>]+content=[\"']([^\"']{20,300})[\"']/i);
  if (og) return decodeHtmlEntities(og[1].trim());
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
 * Filter photos - remove likely logo/icon images and dedupe against the logo URL.
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
/**
 * Strips script/style/nav/header/footer, common menu/breadcrumb wrapper
 * classes, and <title>, from raw HTML before any content-extraction regex
 * runs. Needed because a container-matching regex (e.g. "find a div whose
 * class contains 'about'") can't tell how big that container actually is
 * - on a lot of modern sites the whole page (title, breadcrumb, full nav
 * menu, then the real content) ends up nested inside one wrapper div/main
 * whose id or class happens to contain "about", so the match swallows all
 * of it. Stripping chrome first means even a too-greedy container match
 * can't include nav/menu text, because it's no longer there to include.
 */
function stripChrome(html: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:nav|header|footer)[\s\S]*?<\/(?:nav|header|footer)>/gi, " ")
    .replace(/<[^>]+(?:class|id)=["'][^"']*(?:menu|navbar|breadcrumbs?)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|ul|nav)>/gi, " ");
}

/**
 * Truncates at the last full sentence (or, failing that, the last word)
 * within `max` chars, rather than a hard character slice that can cut off
 * mid-word (e.g. "...too many outdoor projects fa").
 */
function cleanTruncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSentenceEnd = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (lastSentenceEnd > max * 0.4) return slice.slice(0, lastSentenceEnd + 1);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice).trim() + "...";
}

export function extractAbout(html: string): string | null {
  const cleaned = stripChrome(html);

  // Look for about section by common selectors/patterns
  const aboutSection = cleaned.match(
    /<(?:section|div)[^>]*(?:id|class)=["'][^"']*(?:about|who-we-are|our-story|company|team)[^"']*["'][^>]*>([\s\S]{50,2000}?)<\/(?:section|div)>/i
  );
  if (aboutSection) {
    const text = decodeHtmlEntities(
      aboutSection[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    );
    if (text.length > 50) return cleanTruncate(text, 500);
  }

  // Fallback: look for paragraphs near "about" heading
  const nearAbout = cleaned.match(
    /<h[1-4][^>]*>[^<]*(?:about|who we are|our story)[^<]*<\/h[1-4]>\s*(?:<[^>]+>\s*)*<p[^>]*>([\s\S]{50,500}?)<\/p>/i
  );
  if (nearAbout) {
    const text = decodeHtmlEntities(
      nearAbout[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    );
    if (text.length > 50) return cleanTruncate(text, 500);
  }

  return null;
}

/**
 * Curated service vocabulary per trade, used as a keyword-match fallback
 * in extractServices. Structural HTML parsing (a <div>/<section> with a
 * "services" class containing an <li> list) only fires on sites that
 * happen to use that specific markup pattern - checked against production
 * data, that's roughly 7% of the ~4,900 listings with a scraped website,
 * versus 91-96% success for logo/photo extraction which use much looser
 * heuristics. Most real tradie sites (Wix, Squarespace, page builders,
 * one-page sites) just don't structure services as a semantic list.
 *
 * This works completely differently: it doesn't care about markup at
 * all, it matches known industry service phrases against the page's
 * plain text. A one-line prose sentence ("we specialise in switchboard
 * upgrades and safety switch installation") produces a clean result
 * just as reliably as a proper <ul> would. Keyed on the same trade
 * strings already used in directory_listing.trades (see the distinct
 * values query run against production - electrician/plumber/roofer/
 * carpenter/painter/plasterer/aircon/landscaper/concreter/fencer/tiler/
 * handyman/builder cover effectively all listings).
 */
const TRADE_SERVICE_KEYWORDS: Record<string, [match: string, label: string][]> = {
  electrician: [
    ["switchboard", "Switchboard Upgrades"], ["safety switch", "Safety Switch Installation"],
    ["smoke alarm", "Smoke Alarm Installation"], ["ceiling fan installation", "Ceiling Fan Installation"],
    ["power point", "Power Point Installation"], ["lighting installation", "Lighting Installation"],
    ["safety inspection", "Electrical Safety Inspections"], ["hot water system", "Hot Water Systems"],
    ["solar installation", "Solar Installation"], ["data cabling", "Data Cabling"],
    ["rewiring", "Rewiring"], ["commercial electrical", "Commercial Electrical"],
    ["emergency electrician", "Emergency Electrician"], ["led lighting", "LED Lighting Upgrades"],
    ["ev charger", "EV Charger Installation"], ["electrical repairs", "Electrical Repairs"],
    ["electrical installation", "Electrical Installation"],
  ],
  plumber: [
    ["blocked drain", "Blocked Drains"], ["hot water system", "Hot Water Systems"],
    ["leak detection", "Leak Detection"], ["gas fitting", "Gas Fitting"],
    ["burst pipe", "Burst Pipe Repairs"], ["toilet repair", "Toilet Repairs"],
    ["tap repair", "Tap Repairs"], ["bathroom renovation", "Bathroom Renovations"],
    ["backflow prevention", "Backflow Prevention"], ["stormwater", "Stormwater Drainage"],
    ["sewer", "Sewer Repairs"], ["pipe relining", "Pipe Relining"],
    ["emergency plumb", "Emergency Plumbing"], ["roof plumbing", "Roof Plumbing"],
    ["drain clearing", "Drain Clearing"], ["plumbing repairs", "Plumbing Repairs"],
    ["plumbing installation", "Plumbing Installation"],
  ],
  roofer: [
    ["roof repair", "Roof Repairs"], ["roof restoration", "Roof Restoration"],
    ["gutter clean", "Gutter Cleaning"], ["gutter replace", "Gutter Replacement"],
    ["roof leak", "Roof Leak Repairs"], ["re-roofing", "Re-Roofing"], ["reroofing", "Re-Roofing"],
    ["roof paint", "Roof Painting"], ["colorbond roof", "Colorbond Roofing"],
    ["tile roof", "Tile Roof Repairs"], ["roof inspection", "Roof Inspections"],
    ["valley replace", "Valley Replacement"], ["downpipe", "Downpipe Installation"],
    ["metal roofing", "Metal Roofing"], ["roof maintenance", "Roof Maintenance"],
  ],
  carpenter: [
    ["deck", "Decking"], ["pergola", "Pergolas"], ["kitchen renovation", "Kitchen Renovations"],
    ["custom cabinetry", "Custom Cabinetry"], ["flooring installation", "Flooring Installation"],
    ["door installation", "Door Installation"], ["carpentry repairs", "Carpentry Repairs"],
    ["built-in wardrobe", "Built-In Wardrobes"], ["timber flooring", "Timber Flooring"],
    ["renovation", "Renovations"], ["extension", "Home Extensions"], ["framing", "Framing"],
    ["custom joinery", "Custom Joinery"],
  ],
  builder: [
    ["renovation", "Renovations"], ["extension", "Home Extensions"],
    ["new home build", "New Home Builds"], ["custom home", "Custom Home Builds"],
    ["granny flat", "Granny Flats"], ["second storey", "Second Storey Additions"],
    ["knockdown rebuild", "Knockdown Rebuilds"],
  ],
  painter: [
    ["interior paint", "Interior Painting"], ["exterior paint", "Exterior Painting"],
    ["wallpaper", "Wallpapering"], ["ceiling repair", "Ceiling Repairs"],
    ["waterproofing", "Waterproofing"], ["colour consultation", "Colour Consultation"],
    ["commercial paint", "Commercial Painting"], ["roof paint", "Roof Painting"],
    ["repaint", "Repainting"],
  ],
  plasterer: [
    ["plastering", "Plastering"], ["cornice", "Cornice Installation"], ["rendering", "Rendering"],
    ["ceiling repair", "Ceiling Repairs"], ["wall repair", "Wall Repairs"],
    ["gyprock", "Gyprock Installation"], ["waterproofing", "Waterproofing"],
    ["skim coat", "Skim Coating"],
  ],
  aircon: [
    ["split system", "Split System Installation"], ["ducted air conditioning", "Ducted Air Conditioning"],
    ["air conditioning install", "Air Conditioning Installation"],
    ["air conditioning repair", "Air Conditioning Repairs"],
    ["air conditioning service", "Air Conditioning Servicing"],
    ["air conditioning maintenance", "Air Conditioning Maintenance"],
    ["refrigerant", "Refrigerant Regas"], ["reverse cycle", "Reverse Cycle Systems"],
    ["hvac", "HVAC"], ["climate control", "Climate Control"],
    ["aircon install", "Air Conditioning Installation"], ["aircon repair", "Air Conditioning Repairs"],
    ["aircon service", "Air Conditioning Servicing"],
  ],
  "air conditioning": [
    ["split system", "Split System Installation"], ["ducted air conditioning", "Ducted Air Conditioning"],
    ["air conditioning install", "Air Conditioning Installation"],
    ["air conditioning repair", "Air Conditioning Repairs"],
    ["air conditioning service", "Air Conditioning Servicing"],
    ["air conditioning maintenance", "Air Conditioning Maintenance"],
    ["refrigerant", "Refrigerant Regas"], ["reverse cycle", "Reverse Cycle Systems"],
    ["hvac", "HVAC"], ["climate control", "Climate Control"],
  ],
  landscaper: [
    ["garden design", "Garden Design"], ["landscape design", "Landscape Design"],
    ["retaining wall", "Retaining Walls"], ["turf", "Turf Installation"],
    ["irrigation", "Irrigation"], ["paving", "Paving"], ["garden maintenance", "Garden Maintenance"],
    ["outdoor living", "Outdoor Living Areas"], ["excavation", "Excavation"],
  ],
  concreter: [
    ["concrete driveway", "Concrete Driveways"], ["concrete slab", "Concrete Slabs"],
    ["exposed aggregate", "Exposed Aggregate Concrete"], ["concrete resurfacing", "Concrete Resurfacing"],
    ["concrete path", "Concrete Paths"], ["concrete pool", "Concrete Pool Surrounds"],
    ["concrete kerbing", "Concrete Kerbing"],
  ],
  fencer: [
    ["colorbond fenc", "Colorbond Fencing"], ["timber fenc", "Timber Fencing"],
    ["pool fenc", "Pool Fencing"], ["gate installation", "Gate Installation"],
    ["fence repair", "Fence Repairs"], ["glass pool fenc", "Glass Pool Fencing"],
    ["retaining wall", "Retaining Walls"],
  ],
  tiler: [
    ["bathroom tiling", "Bathroom Tiling"], ["floor tiling", "Floor Tiling"],
    ["wall tiling", "Wall Tiling"], ["tile regrout", "Tile Regrouting"],
    ["outdoor tiling", "Outdoor Tiling"], ["waterproofing", "Waterproofing"],
    ["shower tiling", "Shower Tiling"],
  ],
  handyman: [
    ["general repairs", "General Repairs"], ["furniture assembly", "Furniture Assembly"],
    ["shelving", "Shelving Installation"], ["minor repairs", "Minor Repairs"],
    ["home maintenance", "Home Maintenance"], ["flat pack", "Flat Pack Assembly"],
    ["picture hanging", "Picture Hanging"], ["odd jobs", "Odd Jobs"],
  ],
  solar: [
    ["solar panel", "Solar Panel Installation"], ["battery storage", "Battery Storage"],
    ["solar system", "Solar System Upgrades"], ["solar maintenance", "Solar Maintenance"],
    ["off-grid solar", "Off-Grid Solar"],
  ],
};

/**
 * Keyword-match fallback used when structural parsing finds nothing.
 * Case-insensitive substring match against plain text. Each entry is a
 * [matchFragment, displayLabel] pair rather than one string doing both
 * jobs - matching on short fragments ("air conditioning install") catches
 * far more real phrasing variance ("...installation, service &
 * maintenance...") than a rigid full phrase would, but showing that
 * fragment as-is on the listing page reads like a typo, so it's matched
 * loosely and displayed as a clean, complete label ("Air Conditioning
 * Installation").
 */
function extractServicesByKeyword(html: string, trades: string[] | null | undefined): string[] {
  if (!trades || trades.length === 0) return [];
  const plainText = stripChrome(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  const found = new Set<string>();
  for (const trade of trades) {
    const keywords = TRADE_SERVICE_KEYWORDS[trade.toLowerCase().trim()];
    if (!keywords) continue;
    for (const [match, label] of keywords) {
      if (plainText.includes(match)) {
        found.add(label);
        if (found.size >= 10) return [...found];
      }
    }
  }
  return [...found];
}

/**
 * Extract services list from website HTML.
 * Returns the services (max 10) plus which strategy produced them, so
 * callers can record it (services_extraction_method) for later review -
 * structural parsing found on the site's own markup carries more
 * confidence than the keyword fallback, and that distinction matters
 * when judging result quality, not just whether a result exists.
 * Tries structural HTML parsing first (works when the site happens to
 * use a semantic services list); falls back to keyword matching against
 * the page's plain text when that yields fewer than 3 results, since a
 * website that mentions two services in a sidebar list plus several
 * more in prose deserves the fuller list, not whichever strategy ran
 * first. If keyword matching supplements a non-empty structural result,
 * method is still reported as "structural" - the site's own list is
 * still the primary source.
 */
export function extractServices(
  html: string,
  trades?: string[] | null
): { services: string[]; method: "structural" | "keyword" | null } {
  const services: string[] = [];
  const cleaned = stripChrome(html);

  // Look for a services section with a list
  const serviceSection = cleaned.match(
    /<(?:section|div)[^>]*(?:id|class)=["'][^"']*(?:services|what-we-do|specialties)[^"']*["'][^>]*>([\s\S]{50,3000}?)<\/(?:section|div)>/i
  );

  if (serviceSection) {
    const items = serviceSection[1].matchAll(/<li[^>]*>([\s\S]{5,100}?)<\/li>/gi);
    for (const m of items) {
      const text = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
      if (text.length >= 5 && text.length <= 80) {
        services.push(text);
        if (services.length >= 10) break;
      }
    }
  }

  const structuralCount = services.length;

  if (services.length < 3) {
    const byKeyword = extractServicesByKeyword(html, trades);
    for (const s of byKeyword) {
      if (!services.some((existing) => existing.toLowerCase() === s.toLowerCase())) {
        services.push(s);
        if (services.length >= 10) break;
      }
    }
  }

  if (services.length === 0) return { services, method: null };
  return { services, method: structuralCount > 0 ? "structural" : "keyword" };
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

/**
 * Extract social media links from website HTML.
 */
export function extractSocialLinks(html: string): { facebook: string | null; instagram: string | null } {
  const result = { facebook: null as string | null, instagram: null as string | null };

  // Facebook
  const fb = html.match(/href=["\'](https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|share|dialog)[a-zA-Z0-9._/-]{2,80})["\']/i);
  if (fb) result.facebook = fb[1].split("?")[0].replace(/\/$/, "");

  // Instagram
  const ig = html.match(/href=["\'](https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._]{2,60}(?:\/)?)["\']/i);
  if (ig) result.instagram = ig[1].split("?")[0].replace(/\/$/, "");

  return result;
}

/**
 * Extract years of experience from website HTML.
 * Looks for patterns like "25 years experience", "established 1998", "since 2001"
 */
export function extractYearsExperience(html: string): number | null {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();
  const currentYear = new Date().getFullYear();

  // "established in 1998" / "since 2001" / "est. 2005"
  const estMatch = text.match(/(?:established|est\.?|founded|operating since|trading since|in business since|since)\s+(?:in\s+)?(19\d{2}|20[01]\d|202[0-4])/i);
  if (estMatch) {
    const year = parseInt(estMatch[1]);
    const years = currentYear - year;
    if (years >= 1 && years <= 100) return years;
  }

  // "25 years experience" / "over 20 years"
  const expMatch = text.match(/(?:over\s+)?(\d{1,2})\+?\s+years?\s+(?:of\s+)?(?:experience|in\s+(?:the\s+)?(?:industry|trade|business))/i);
  if (expMatch) {
    const years = parseInt(expMatch[1]);
    if (years >= 1 && years <= 80) return years;
  }

  return null;
}

/**
 * Extract trade licences and registrations from website HTML.
 * Looks for licence numbers, QBCC, VBA, Fair Trading, master electrician etc.
 */
export function extractLicenses(html: string): { type: string; number: string }[] {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const licenses: { type: string; number: string }[] = [];
  const seen = new Set<string>();

  const PATTERNS: { type: string; regex: RegExp }[] = [
    { type: "QBCC Licence",          regex: /QBCC\s+(?:Licence|License|No\.?|#)?\s*:?\s*([0-9]{5,10})/gi },
    { type: "VBA Registration",      regex: /VBA\s+(?:Reg(?:istration)?|No\.?|#)?\s*:?\s*([A-Z0-9]{4,12})/gi },
    { type: "Electrical Licence",    regex: /(?:electrical|electrician)\s+licen[sc]e\s+(?:no\.?|#|number)?\s*:?\s*([A-Z0-9]{3,12})/gi },
    { type: "Plumbing Licence",      regex: /plumb(?:ing|er)\s+licen[sc]e\s+(?:no\.?|#|number)?\s*:?\s*([A-Z0-9]{3,12})/gi },
    { type: "Master Electricians",   regex: /(master\s+electricians?\s+australia)/gi },
    { type: "Master Plumbers",       regex: /(master\s+plumbers?)/gi },
    { type: "HIA Member",            regex: /(hia\s+member|housing\s+industry\s+association)/gi },
    { type: "MBA Member",            regex: /(master\s+builders?\s+association)/gi },
    { type: "NECA Member",           regex: /(neca|national\s+electrical\s+(?:and\s+)?communications?\s+association)/gi },
    { type: "ABN",                   regex: /ABN\s*:?\s*(\d{2}\s*\d{3}\s*\d{3}\s*\d{3})/gi },
    { type: "Contractor Licence",    regex: /contractor(?:\'s)?\s+licen[sc]e\s+(?:no\.?|#)?\s*:?\s*([A-Z0-9]{3,12})/gi },
    { type: "Building Licence",      regex: /building\s+(?:practitioners?\s+)?licen[sc]e\s+(?:no\.?|#)?\s*:?\s*([A-Z0-9]{3,12})/gi },
  ];

  for (const { type, regex } of PATTERNS) {
    const matches = [...text.matchAll(regex)];
    for (const m of matches) {
      const number = (m[1] ?? "").trim().replace(/\s+/g, " ");
      const key = `${type}:${number}`;
      if (!seen.has(key)) {
        seen.add(key);
        licenses.push({ type, number });
        if (licenses.length >= 5) break;
      }
    }
    if (licenses.length >= 5) break;
  }

  return licenses;
}

/**
 * Scrape an about page or services page if linked from the homepage.
 * Returns combined text content.
 */
export async function scrapeSubPages(
  html: string,
  baseUrl: string
): Promise<{ aboutText: string | null; servicesText: string | null }> {
  const result = { aboutText: null as string | null, servicesText: null as string | null };

  // Find about and services page links
  const aboutHref  = html.match(/href=["\'](\/[^"\']*(?:about|who-we-are|our-story|company)[^"\']*)["\']/i);
  const serviceHref = html.match(/href=["\'](\/[^"\']*(?:services?|what-we-do|our-work)[^"\']*)["\']/i);

  async function fetchSubPage(path: string): Promise<string | null> {
    try {
      const url = new URL(path, baseUrl).href;
      if (url === baseUrl) return null; // avoid refetching homepage
      return await fetchWebsiteHtml(url);
    } catch { return null; }
  }

  if (aboutHref) {
    const aboutHtml = await fetchSubPage(aboutHref[1]);
    if (aboutHtml) {
      // Try the same targeted extraction used on the homepage first -
      // it looks for an actual about/story container or heading+paragraph,
      // rather than just grabbing whatever text happens to come first on
      // the page. On a lot of modern sites that's the full mega-menu
      // (Services > Design & Planning, Outdoor Building, ... Company >
      // About, Team, Careers ...) since it isn't always wrapped in a
      // literal <nav>/<header> tag the crude fallback below can strip.
      const targeted = extractAbout(aboutHtml);
      if (targeted) {
        result.aboutText = targeted;
      } else {
        // Fallback: stripChrome already removed script/style/nav/header/
        // footer/title/menu chrome above (via extractAbout's own call to
        // it) - redo that here since this path works from the raw
        // aboutHtml directly, then prefer content inside <main> if present,
        // and only then fall back to the whole (already-stripped) body.
        let stripped = stripChrome(aboutHtml);

        const main = stripped.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
        if (main) stripped = main[1];

        const text = decodeHtmlEntities(
          stripped.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        );
        if (text.length > 100) result.aboutText = cleanTruncate(text, 800);
      }
    }
  }

  if (serviceHref && serviceHref[1] !== aboutHref?.[1]) {
    const servHtml = await fetchSubPage(serviceHref[1]);
    if (servHtml) {
      // Extract service list items from the services page - strip chrome
      // first, otherwise this happily scoops up every <li> in the nav menu
      // too (which is exactly how a services page's real content ends up
      // as a list of nav labels like "Design & Planning", "Careers").
      const cleanedServHtml = stripChrome(servHtml);
      const items: string[] = [];
      const liMatches = cleanedServHtml.matchAll(/<li[^>]*>(.*?)<\/li>/gi);
      for (const m of liMatches) {
        const text = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "").trim());
        if (text.length >= 5 && text.length <= 80) {
          items.push(text);
          if (items.length >= 12) break;
        }
      }
      if (items.length > 0) result.servicesText = items.join("\n");
    }
  }

  return result;
}
