import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import {
  fetchWebsiteHtml, extractLogoUrl, extractBlurb,
  extractPhotos, extractAbout, extractPhone,
} from "@/lib/websiteScraper";

function extractBusinessName(html: string, url: string): string | null {
  // og:site_name is most reliable
  const og = html.match(/<meta[^>]+property=[\"']og:site_name[\"'][^>]+content=[\"']([^\"']{2,80})[\"']/i)
    ?? html.match(/<meta[^>]+content=[\"']([^\"']{2,80})[\"'][^>]+property=[\"']og:site_name[\"']/i);
  if (og) return og[1].trim();

  // <title> tag -- trim common suffixes
  const title = html.match(/<title[^>]*>([^<]{2,100})<\/title>/i);
  if (title) {
    return title[1]
      .replace(/\s*[\|\-–]\s*.{0,60}$/, "") // strip "| Home" etc
      .replace(/\s*(home|welcome|official site)\s*$/i, "")
      .trim();
  }

  // h1 on homepage
  const h1 = html.match(/<h1[^>]*>([^<]{2,80})<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, "").trim();

  // Fall back to domain
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  } catch { return null; }
}

function extractAddress(html: string): { suburb: string | null; postcode: string | null; state: string | null } {
  // JSON-LD address
  const jsonLd = html.match(/<script[^>]+type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]+?)<\/script>/gi);
  if (jsonLd) {
    for (const block of jsonLd) {
      try {
        const data = JSON.parse(block.replace(/<[^>]+>/g, ""));
        const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
        for (const item of items) {
          const addr = item.address ?? {};
          if (addr.addressLocality || addr.postalCode) {
            return {
              suburb: addr.addressLocality ?? null,
              postcode: addr.postalCode ?? null,
              state: addr.addressRegion ?? null,
            };
          }
        }
      } catch {}
    }
  }

  // AU postcode pattern in text
  const postcodeMatch = html.match(/\b(\d{4})\b.*?\b(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\b|\b(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\b.*?\b(\d{4})\b/i);
  if (postcodeMatch) {
    const postcode = postcodeMatch[1] ?? postcodeMatch[4];
    const state    = postcodeMatch[2] ?? postcodeMatch[3];
    return { suburb: null, postcode: postcode ?? null, state: state ?? null };
  }

  return { suburb: null, postcode: null, state: null };
}

function extractTrades(html: string, url: string): string[] {
  const TRADE_KEYWORDS: Record<string, string[]> = {
    electrician: ["electrician","electrical","wiring","switchboard","powerpoint","lighting install"],
    plumber:     ["plumber","plumbing","drain","pipe","hot water","blocked drain"],
    carpenter:   ["carpenter","carpentry","cabinetry","joinery","decking","framing"],
    roofer:      ["roofing","roofer","gutters","roof repair","colorbond","re-roof"],
    painter:     ["painter","painting","interior paint","exterior paint","wall painting"],
    tiler:       ["tiler","tiling","floor tile","wall tile","bathroom tile"],
    landscaper:  ["landscaper","landscaping","garden design","lawn","retaining wall"],
    builder:     ["builder","building","construction","renovation","extension"],
    concreter:   ["concreter","concreting","concrete","driveway","slab"],
    plasterer:   ["plasterer","plastering","render","gyprock"],
    airconditioning: ["air conditioning","aircon","hvac","split system","ducted"],
    solar:       ["solar","solar panel","photovoltaic","battery storage"],
  };

  const text = (html + " " + url).toLowerCase();
  const found: string[] = [];
  for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) found.push(trade);
    if (found.length >= 3) break;
  }
  return found.length > 0 ? found : ["builder"]; // default fallback
}

async function downloadAndStore(
  photoUrl: string,
  listingId: string,
  idx: number,
  admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(photoUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Swiftscope-Bot/1.0 (+https://swiftscope.com.au)" },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) return null;
    const ext = contentType.includes("png") ? "png" : "jpg";
    const path = `manual/${listingId ?? "new"}/${idx}.${ext}`;
    const { error } = await admin.storage.from("directory-photos").upload(path, buffer, { upsert: true, contentType });
    if (error) return null;
    const { data: pub } = admin.storage.from("directory-photos").getPublicUrl(path);
    return pub.publicUrl;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { url, overwrite = false } = await req.json();
  if (!url?.startsWith("http")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Normalise URL
  const siteUrl = url.trim().replace(/\/$/, "");

  // Fetch HTML
  const html = await fetchWebsiteHtml(siteUrl);
  if (!html) {
    return NextResponse.json({ error: "Could not fetch that URL. The site may be down or blocking scrapers." }, { status: 422 });
  }

  // Extract all fields
  const businessName = extractBusinessName(html, siteUrl);
  const logo         = extractLogoUrl(html, siteUrl);
  const blurb        = extractBlurb(html);
  const about        = extractAbout(html);
  const phone        = extractPhone(html);
  const { suburb, postcode, state } = extractAddress(html);
  const trades       = extractTrades(html, siteUrl);
  const photoUrls    = extractPhotos(html, siteUrl);

  // Check if listing already exists (by website_url)
  const { data: existing } = await admin
    .from("directory_listing")
    .select("id, business_name, photo_references")
    .ilike("website_url", siteUrl)
    .limit(1);

  const existingListing = existing?.[0];
  const listingId = existingListing?.id ?? crypto.randomUUID();

  // Download and store photos
  const storedPhotos: string[] = [];
  for (let i = 0; i < Math.min(photoUrls.length, 6); i++) {
    const stored = await downloadAndStore(photoUrls[i], listingId, i, admin);
    if (stored) storedPhotos.push(stored);
  }

  // Merge with existing photos if updating
  const existingPhotos = existingListing
    ? ((existingListing.photo_references ?? []) as string[]).filter((p: string) => p.startsWith("http"))
    : [];
  const allPhotos = [...new Set([...storedPhotos, ...existingPhotos])].slice(0, 6);

  const payload = {
    business_name:          businessName,
    website_url:            siteUrl,
    logo_url:               logo,
    blurb:                  about ?? blurb,
    scraped_contact_phone:  phone,
    suburb,
    postcode,
    state,
    trades,
    photo_references:       allPhotos.length > 0 ? allPhotos : null,
    photos_cached_at:       allPhotos.length > 0 ? new Date().toISOString() : null,
    website_scraped_at:     new Date().toISOString(),
    source:                 "manual",
    is_claimed:             false,
  };

  // Remove null values unless overwriting
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v !== null || overwrite) clean[k] = v;
  }

  let action: "created" | "updated";

  if (existingListing) {
    // Update existing -- use direct update so we preserve the slug
    const updateData = overwrite
      ? clean
      : Object.fromEntries(Object.entries(clean).filter(([k]) => !["id", "source"].includes(k)));
    const { error: updateErr } = await admin
      .from("directory_listing")
      .update(updateData)
      .eq("id", existingListing.id);
    if (updateErr) console.error("[scrape-url] update error:", updateErr);
    action = "updated";
  } else {
    // Create new -- use RPC so slug is auto-generated from business_name + suburb
    const { error: rpcErr } = await admin.rpc("upsert_directory_listing", {
      p_business_name:         businessName ?? siteUrl,
      p_trades:                trades,
      p_website_url:           siteUrl,
      p_suburb:                suburb,
      p_postcode:              postcode,
      p_latitude:              null,
      p_longitude:             null,
      p_place_id:              null,
      p_google_rating:         null,
      p_google_reviews_count:  null,
      p_photo_references:      allPhotos.length > 0 ? allPhotos : [],
      p_scraped_contact_phone: phone,
      p_private_email:         null,
      p_logo_url:              logo,
    });

    if (rpcErr) {
      console.error("[scrape-url] RPC error, falling back to direct insert:", rpcErr);
      // Fallback: direct insert with manual slug
      const slug = (businessName ?? "listing")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        + (suburb ? "-" + suburb.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "")
        + "-" + Date.now().toString(36);

      await admin.from("directory_listing").insert({
        ...clean,
        id:   listingId,
        slug,
      });
    }

    // Now update the freshly created listing with photos/blurb (RPC doesn't take all fields)
    const { data: fresh } = await admin
      .from("directory_listing")
      .select("id")
      .ilike("website_url", siteUrl)
      .limit(1);

    if (fresh?.[0]) {
      await admin.from("directory_listing").update({
        blurb:              about ?? blurb,
        photos_cached_at:   allPhotos.length > 0 ? new Date().toISOString() : null,
        website_scraped_at: new Date().toISOString(),
        source:             "manual",
      }).eq("id", fresh[0].id);
    }

    action = "created";
  }

  // Fetch the slug for the public listing URL
  const { data: finalListing } = await admin
    .from("directory_listing")
    .select("id, slug")
    .ilike("website_url", siteUrl)
    .limit(1);

  return NextResponse.json({
    action,
    id:   finalListing?.[0]?.id ?? existingListing?.id ?? listingId,
    slug: finalListing?.[0]?.slug ?? null,
    extracted: {
      business_name: businessName,
      trades,
      suburb,
      postcode,
      state,
      phone,
      logo: !!logo,
      blurb: !!(about ?? blurb),
      photos: storedPhotos.length,
    },
  });
}
