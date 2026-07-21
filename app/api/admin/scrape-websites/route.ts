import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { fetchWebsiteHtml, extractLogoUrl, extractBlurb, extractPhotos, extractAbout, extractServices, extractPhone } from "@/lib/websiteScraper";

const BATCH = 30;

async function downloadAndStore(
  photoUrl: string,
  listingId: string,
  idx: number,
  admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(photoUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Swiftscope-Bot/1.0 (+https://swiftscope.com.au)" },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) return null; // skip tiny icons
    const ext = contentType.includes("png") ? "png" : "jpg";
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

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body.mode ?? "all";

  const admin = createAdminClient();

  // Build targeted query based on mode -- only fetch listings that actually
  // need the specific field we're trying to fill
  let query = admin
    .from("directory_listing")
    .select("id, business_name, website_url, logo_url, blurb, photo_references, services_offered, scraped_contact_phone", { count: "exact" })
    .not("website_url", "is", null)
    .eq("is_claimed", false);

  if (mode === "photos" || mode === "all") {
    // Listings where photo_references is empty OR all refs are Google tokens (not http)
    query = query.or("photos_cached_at.is.null,photo_references.is.null,photo_references.eq.{}");
  } else if (mode === "logo") {
    query = query.is("logo_url", null);
  } else if (mode === "blurb") {
    query = query.is("blurb", null);
  }

  const { data: listings, count } = await query
    .order("website_scraped_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);

  // Further filter in code: skip listings that already have what we need
  const needsWork = (listings ?? []).filter(listing => {
    const refs = (listing.photo_references ?? []) as string[];
    const cachedPhotos = refs.filter(r => r.startsWith("http"));
    if (mode === "photos" || mode === "all") {
      if (cachedPhotos.length >= 2) return false; // already has photos
    }
    if (mode === "logo" && listing.logo_url) return false;
    if (mode === "blurb" && listing.blurb) return false;
    return true;
  });

  const results = {
    processed: 0, updated: 0, skipped: 0, failed: 0,
    remaining: Math.max(0, (count ?? 0) - BATCH),
    detail: [] as string[],
    skipReasons: {} as Record<string, number>,
  };

  for (const listing of needsWork) {
    results.processed++;
    const url = listing.website_url as string;

    const html = await fetchWebsiteHtml(url);
    if (!html) {
      results.failed++;
      results.skipReasons["fetch failed / timeout"] = (results.skipReasons["fetch failed / timeout"] ?? 0) + 1;
      // Stamp so we don't retry immediately -- will retry after other listings
      await admin.from("directory_listing")
        .update({ website_scraped_at: new Date().toISOString() })
        .eq("id", listing.id);
      continue;
    }

    const updates: Record<string, unknown> = {
      website_scraped_at: new Date().toISOString(),
    };
    const updated: string[] = [];

    // Logo
    if ((mode === "logo" || mode === "all") && !listing.logo_url) {
      const logo = extractLogoUrl(html, url);
      if (logo) { updates.logo_url = logo; updated.push("logo_url"); }
    }

    // Blurb
    if ((mode === "blurb" || mode === "all") && !listing.blurb) {
      const blurb = extractBlurb(html);
      if (blurb) { updates.blurb = blurb; updated.push("blurb"); }
    }

    // About (extended description -- separate from blurb)
    if ((mode === "blurb" || mode === "all") && !listing.blurb) {
      const about = extractAbout(html);
      if (about && !updates.blurb) { updates.blurb = about; updated.push("blurb (about)"); }
    }

    // Services list
    if (mode === "all" && !(listing as {services_offered?: unknown}).services_offered) {
      const services = extractServices(html);
      if (services.length > 0) { updates.services_offered = services; updated.push(`services (${services.length})`); }
    }

    // Phone (if not already scraped)
    if (mode === "all" && !(listing as {scraped_contact_phone?: unknown}).scraped_contact_phone) {
      const phone = extractPhone(html);
      if (phone) { updates.scraped_contact_phone = phone; updated.push("phone"); }
    }

    // Photos
    if (mode === "photos" || mode === "all") {
      const existing = (listing.photo_references ?? []) as string[];
      const alreadyCached = existing.filter(r => r.startsWith("http"));

      if (alreadyCached.length < 2) {
        const photoUrls = extractPhotos(html, url);
        const newPhotos: string[] = [...alreadyCached];

        for (let i = 0; i < photoUrls.length && newPhotos.length < 4; i++) {
          const stored = await downloadAndStore(photoUrls[i], listing.id, i, admin);
          if (stored) newPhotos.push(stored);
        }

        if (newPhotos.length > alreadyCached.length) {
          updates.photo_references = newPhotos;
          updates.photos_cached_at = new Date().toISOString();
          updated.push(`photo_references (${newPhotos.length} photos)`);
        } else {
          // No photos found on website -- stamp so we don't retry immediately
          updates.photos_cached_at = new Date().toISOString();
          results.skipReasons["no photos found on site"] = (results.skipReasons["no photos found on site"] ?? 0) + 1;
        }
      }
    }

    await admin.from("directory_listing").update(updates).eq("id", listing.id);

    if (updated.length > 0) {
      results.updated++;
      results.detail.push(`✓ ${listing.business_name} (${updated.join(", ")})`);
    } else {
      results.skipped++;
      results.detail.push(`⁃ ${listing.business_name} (nothing extractable from ${url.slice(0, 40)})`);
    }
  }

  // Add listings that had all fields already (filtered out before processing)
  const alreadyComplete = (listings?.length ?? 0) - needsWork.length;
  if (alreadyComplete > 0) {
    results.skipReasons[`already complete`] = alreadyComplete;
    results.skipped += alreadyComplete;
  }

  return NextResponse.json(results);
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [total, withWebsite, withPhotos, withLogo, withBlurb, noWebsite] = await Promise.all([
    admin.from("directory_listing").select("id", { count: "exact", head: true }).then(r => r.count ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).not("website_url", "is", null).then(r => r.count ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).not("photos_cached_at", "is", null).then(r => r.count ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).not("logo_url", "is", null).then(r => r.count ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).not("blurb", "is", null).then(r => r.count ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).is("website_url", null).then(r => r.count ?? 0),
  ]);

  return NextResponse.json({ total, withWebsite, withPhotos, withLogo, withBlurb, noWebsite });
}
