import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { fetchWebsiteHtml, extractLogoUrl, extractBlurb, extractPhotos, extractAbout, extractServices, extractPhone, extractSocialLinks, extractYearsExperience, extractLicenses, scrapeSubPages, scrapeGalleryPhotos, scrapeTestimonials } from "@/lib/websiteScraper";

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

  type ListingRow = {
    id: string; business_name: string; website_url: string | null; logo_url: string | null;
    blurb: string | null; photo_references: string[] | null; services_offered: string[] | null;
    scraped_contact_phone: string | null; trades: string[] | null; testimonials: unknown[] | null;
  };

  let listings: ListingRow[] | null;
  let count: number;

  if (mode === "photos" || mode === "all") {
    // photo_references IS NULL/empty misses the far more common real
    // case: raw Google Place photo tokens sitting there from the
    // original import, which the frontend correctly won't render (only
    // http URLs get shown) but which the old .is()/.eq() filter treated
    // as "has photos" since the column wasn't technically empty. Fixed
    // via a proper Postgres function (see migration) that checks for at
    // least one actually-renderable http entry, not just non-null.
    const [{ data: rpcListings }, { data: rpcCount }] = await Promise.all([
      admin.rpc("listings_needing_photo_recache", { p_limit: BATCH }),
      admin.rpc("count_listings_needing_photo_recache"),
    ]);
    listings = (rpcListings ?? []) as ListingRow[];
    count = (rpcCount as number | null) ?? 0;
  } else {
    let query = admin
      .from("directory_listing")
      .select("id, business_name, website_url, logo_url, blurb, photo_references, services_offered, scraped_contact_phone, trades, testimonials", { count: "exact" })
      .not("website_url", "is", null)
      .eq("is_claimed", false);

    if (mode === "logo") {
      query = query.is("logo_url", null);
    } else if (mode === "blurb") {
      query = query.is("blurb", null);
    }

    const res = await query
      .order("website_scraped_at", { ascending: true, nullsFirst: true })
      .limit(BATCH);
    listings = res.data as ListingRow[] | null;
    count = res.count ?? 0;
  }

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
      // Stamp so we don't retry immediately - will retry after other listings
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

    // About (extended description - separate from blurb)
    if ((mode === "blurb" || mode === "all") && !listing.blurb) {
      const about = extractAbout(html);
      if (about && !updates.blurb) { updates.blurb = about; updated.push("blurb (about)"); }
    }

    // Services list
    if (mode === "all" && !(listing as {services_offered?: unknown}).services_offered) {
      const { services, method } = extractServices(html, listing.trades as string[] | null);
      if (services.length > 0) {
        updates.services_offered = services;
        updates.services_extraction_method = method;
        updated.push(`services (${services.length}, ${method})`);
      }
    }

    // Phone (if not already scraped)
    if (mode === "all" && !(listing as {scraped_contact_phone?: unknown}).scraped_contact_phone) {
      const phone = extractPhone(html);
      if (phone) { updates.scraped_contact_phone = phone; updated.push("phone"); }
    }

    // Social links
    if (mode === "all") {
      const social = extractSocialLinks(html);
      if (social.facebook && !(listing as {facebook_url?: unknown}).facebook_url) {
        updates.facebook_url = social.facebook; updated.push("facebook");
      }
      if (social.instagram && !(listing as {instagram_url?: unknown}).instagram_url) {
        updates.instagram_url = social.instagram; updated.push("instagram");
      }
    }

    // Years experience
    if (mode === "all" && !(listing as {years_experience?: unknown}).years_experience) {
      const years = extractYearsExperience(html);
      if (years) { updates.years_experience = years; updated.push(`${years}yrs exp`); }
    }

    // Licences
    if (mode === "all" && !(listing as {licenses?: unknown}).licenses) {
      const lics = extractLicenses(html);
      if (lics.length > 0) { updates.licenses = lics; updated.push(`${lics.length} licence(s)`); }
    }

    // Testimonials - free, billing-independent complement to Google
    // reviews (which require Places API billing, currently disabled on
    // the Google Cloud project - confirmed via runtime logs, every
    // review call is failing REQUEST_DENIED right now).
    if (mode === "all" && !listing.testimonials) {
      const testimonials = await scrapeTestimonials(html, url);
      if (testimonials.length > 0) { updates.testimonials = testimonials; updated.push(`${testimonials.length} testimonial(s)`); }
    }

    // Services from sub-pages (only in all mode - extra network call)
    if (mode === "all" && !(listing as {services_offered?: unknown}).services_offered) {
      const subs = await scrapeSubPages(html, url);
      const { services: baseServices, method: baseMethod } = extractServices(html, listing.trades as string[] | null);
      const svcs = [...baseServices];
      const subPageAddedAny = !!subs.servicesText;
      if (subs.servicesText) svcs.push(...subs.servicesText.split("\n").filter(Boolean));
      const unique = [...new Set(svcs)].slice(0, 12);
      if (unique.length > 0) {
        updates.services_offered = unique;
        // Real page text (sub-page scrape or structural parse) beats a
        // pure keyword guess for confidence, so any contribution from
        // either counts as "structural" here - only report "keyword"
        // when nothing but the keyword fallback produced a result.
        updates.services_extraction_method = (baseMethod === "structural" || subPageAddedAny) ? "structural" : baseMethod;
        updated.push(`services (${unique.length}, ${updates.services_extraction_method})`);
      }
      // Upgrade blurb with about sub-page if current blurb is short
      const currentBlurb = (listing as {blurb?: string | null}).blurb;
      if (subs.aboutText && (!currentBlurb || currentBlurb.length < 100)) {
        updates.blurb = subs.aboutText; updated.push("blurb (about page)");
      }
    }

    // Photos
    if (mode === "photos" || mode === "all") {
      const existing = (listing.photo_references ?? []) as string[];
      const alreadyCached = existing.filter(r => r.startsWith("http"));

      if (alreadyCached.length < 2) {
        const photoUrls = [...extractPhotos(html, url)];
        // Gallery page often has the best real job photos - homepage
        // hero images are frequently stock imagery or generic banners.
        const galleryPhotos = await scrapeGalleryPhotos(html, url);
        for (const p of galleryPhotos) {
          if (!photoUrls.includes(p)) photoUrls.push(p);
        }
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
          // No photos found on website - stamp so we don't retry immediately
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

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [total, withWebsite, withPhotos, withLogo, withBlurb, withServices, noWebsite] = await Promise.all([
    admin.from("directory_listing").select("id", { count: "exact", head: true }).then(r => r.count ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).not("website_url", "is", null).then(r => r.count ?? 0),
    admin.rpc("count_listings_with_renderable_photo").then(r => (r.data as number | null) ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).not("logo_url", "is", null).then(r => r.count ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).not("blurb", "is", null).then(r => r.count ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).not("services_offered", "is", null).then(r => r.count ?? 0),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).is("website_url", null).then(r => r.count ?? 0),
  ]);

  const stats = { total, withWebsite, withPhotos, withLogo, withBlurb, withServices, noWebsite };

  // Review list: most recently scraped listings, newest first, so a
  // just-run batch is at the top. Shows the full picture per listing
  // (photos, logo, blurb, services, phone, years, licences) rather than
  // just services, since aggregate stats above can't tell you whether
  // any *specific* business actually got enriched properly. Capped at
  // 100. photo_references is filtered to real http entries here (not
  // raw Google tokens) so the UI only ever shows photos that would
  // actually render on the live listing page.
  if (new URL(req.url).searchParams.get("recent") === "1") {
    const { data: recentRaw } = await admin
      .from("directory_listing")
      .select("id, business_name, suburb, trades, website_url, services_offered, services_extraction_method, blurb, logo_url, photo_references, years_experience, licenses, scraped_contact_phone, website_scraped_at")
      .not("website_scraped_at", "is", null)
      .order("website_scraped_at", { ascending: false, nullsFirst: false })
      .limit(100);

    const recent = (recentRaw ?? []).map((r) => ({
      ...r,
      photo_references: (r.photo_references ?? []).filter((p: string) => p.startsWith("http")),
    }));

    return NextResponse.json({ ...stats, recent });
  }

  return NextResponse.json(stats);
}
