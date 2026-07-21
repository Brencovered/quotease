import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { fetchWebsiteHtml, extractLogoUrl, extractBlurb, extractPhotos, resolveUrl } from "@/lib/websiteScraper";

const BATCH = 30; // per invocation -- website fetches are slow

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
