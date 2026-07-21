import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { fetchWebsiteHtml, extractLogoUrl } from "@/app/api/admin/scrape/route";

const BATCH = 30; // per invocation -- website fetches are slow

/* ── Extract photos from website HTML ──────────────────────────── */
function extractPhotos(html: string, baseUrl: string): string[] {
  const photos: string[] = [];
  const seen = new Set<string>();

  function add(url: string) {
    if (!url) return;
    const resolved = resolveUrl(url, baseUrl);
    if (!resolved) return;
    // Skip tiny icons, tracking pixels, SVGs, data URIs
    if (resolved.startsWith("data:")) return;
    if (/\.(svg|ico|gif|webp)$/i.test(resolved)) return;
    if (/\/(icon|favicon|pixel|tracking|spacer|placeholder)/i.test(resolved)) return;
    if (seen.has(resolved)) return;
    seen.add(resolved);
    photos.push(resolved);
  }

  // og:image -- best quality, designed for sharing
  const og = html.match(/<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']/i)
    ?? html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:image[\"']/i);
  if (og) add(og[1]);

  // Twitter card image
  const tw = html.match(/<meta[^>]+name=[\"']twitter:image[\"'][^>]+content=[\"']([^\"']+)[\"']/i);
  if (tw) add(tw[1]);

  // Large images in hero/banner/gallery sections
  const heroSection = html.match(/<(?:section|div)[^>]*(?:hero|banner|gallery|slider|carousel)[^>]*>([\s\S]{0,3000})/i);
  if (heroSection) {
    const imgMatches = heroSection[1].matchAll(/<img[^>]+src=[\"']([^\"']+)[\"'][^>]*>/gi);
    for (const m of imgMatches) add(m[1]);
  }

  // Structured data images (JSON-LD)
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

/* ── Extract blurb from website HTML ───────────────────────────── */
function extractBlurb(html: string): string | null {
  // Meta description
  const desc = html.match(/<meta[^>]+name=[\"']description[\"'][^>]+content=[\"']([^\"']{20,300})[\"']/i)
    ?? html.match(/<meta[^>]+content=[\"']([^\"']{20,300})[\"'][^>]+name=[\"']description[\"']/i);
  if (desc) return desc[1].trim();

  // og:description
  const og = html.match(/<meta[^>]+property=[\"']og:description[\"'][^>]+content=[\"']([^\"']{20,300})[\"']/i);
  if (og) return og[1].trim();

  return null;
}

/* ── Resolve URL ────────────────────────────────────────────────── */
function resolveUrl(url: string, base: string): string {
  if (!url) return "";
  try {
    return new URL(url, base).href;
  } catch {
    return "";
  }
}

/* ── Download and store a photo in Supabase Storage ────────────── */
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

    const ext = contentType.includes("png") ? "png" : "jpg";
    const buffer = Buffer.from(await res.arrayBuffer());

    // Skip tiny images (less than 5KB = likely icons)
    if (buffer.length < 5000) return null;

    const path = `website/${listingId}/${idx}.${ext}`;
    const { error } = await admin.storage
      .from("directory-photos")
      .upload(path, buffer, { upsert: true, contentType });

    if (error) return null;

    const { data: pub } = admin.storage.from("directory-photos").getPublicUrl(path);
    return pub.publicUrl;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/scrape-websites
   Batch-processes listings that have website_url but missing photos,
   logo, or blurb. Pulls content from their own website -- free, no
   Google API calls.
═══════════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body.mode ?? "all"; // "photos" | "logo" | "blurb" | "all"

  const admin = createAdminClient();

  // Get listings with a website URL that need enriching
  const { data: listings, count } = await admin
    .from("directory_listing")
    .select("id, business_name, website_url, logo_url, blurb, photo_references", { count: "exact" })
    .not("website_url", "is", null)
    .eq("is_claimed", false)
    // Prioritise listings with no cached photos (only Google tokens or empty)
    .or("photos_cached_at.is.null,logo_url.is.null,blurb.is.null")
    .order("photos_cached_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);

  const results = {
    processed: 0, updated: 0, skipped: 0, failed: 0,
    remaining: (count ?? 0) - (listings?.length ?? 0),
    detail: [] as string[],
  };

  for (const listing of listings ?? []) {
    results.processed++;
    const url = listing.website_url as string;

    const html = await fetchWebsiteHtml(url);
    if (!html) {
      results.skipped++;
      // Stamp website_scraped_at so we don't retry failed sites immediately
      await admin.from("directory_listing")
        .update({ website_scraped_at: new Date().toISOString() })
        .eq("id", listing.id);
      continue;
    }

    const updates: Record<string, unknown> = {
      website_scraped_at: new Date().toISOString(),
    };

    // ── Logo ─────────────────────────────────────────────────────
    if ((mode === "logo" || mode === "all") && !listing.logo_url) {
      const logo = extractLogoUrl(html, url);
      if (logo) updates.logo_url = logo;
    }

    // ── Blurb ────────────────────────────────────────────────────
    if ((mode === "blurb" || mode === "all") && !listing.blurb) {
      const blurb = extractBlurb(html);
      if (blurb) updates.blurb = blurb;
    }

    // ── Photos ───────────────────────────────────────────────────
    if (mode === "photos" || mode === "all") {
      const existing = (listing.photo_references ?? []) as string[];
      const cachedCount = existing.filter(r => r.startsWith("http")).length;

      if (cachedCount < 3) {
        const photoUrls = extractPhotos(html, url);
        const newPhotos: string[] = [...existing.filter(r => r.startsWith("http"))];

        for (let i = 0; i < photoUrls.length && newPhotos.length < 6; i++) {
          const stored = await downloadAndStore(photoUrls[i], listing.id, i, admin);
          if (stored) newPhotos.push(stored);
        }

        if (newPhotos.length > cachedCount) {
          updates.photo_references = newPhotos;
          updates.photos_cached_at = new Date().toISOString();
        }
      }
    }

    if (Object.keys(updates).length > 1) { // more than just the timestamp
      await admin.from("directory_listing").update(updates).eq("id", listing.id);
      results.updated++;
      results.detail.push(`✓ ${listing.business_name} (${Object.keys(updates).filter(k => k !== "website_scraped_at").join(", ")})`);
    } else {
      // Nothing to update but stamp it anyway
      await admin.from("directory_listing").update(updates).eq("id", listing.id);
      results.skipped++;
    }
  }

  return NextResponse.json(results);
}

/* ── GET: return stats on how many listings need enriching ──────── */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [total, withWebsite, withPhotos, withLogo, withBlurb] = await Promise.all([
    admin.from("directory_listing").select("id", { count: "exact", head: true }).then(r => r.count ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).not("website_url", "is", null).then(r => r.count ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).not("photos_cached_at", "is", null).then(r => r.count ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).not("logo_url", "is", null).then(r => r.count ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).not("blurb", "is", null).then(r => r.count ?? 0),
  ]);

  return NextResponse.json({ total, withWebsite, withPhotos, withLogo, withBlurb });
}
