import { createAdminClient } from "@/lib/supabase/admin";

const BATCH_SIZE = 200; // photo downloads are heavier than the logo refresh's plain HTML fetch
const REFRESH_INTERVAL_DAYS = 180; // ~6 months, per Brendan
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

export interface CachePhotosBatchResult {
  checked: number;
  cached: number;
  skippedNoPhotos: number;
  failed: number;
  totalDue: number;
  remaining: number;
}

/**
 * Downloads each scraped listing's Google Places photos ONCE and stores
 * them permanently in Supabase Storage, replacing the opaque
 * photo_reference tokens in photo_references with real, public URLs.
 *
 * Why: PhotoGallery.tsx and DirectoryCard.tsx call /api/places/photo on
 * every single page view for any photo_reference that isn't already a
 * full URL -- that's a live, paid Google Places Photo API call per view,
 * forever, for as long as the listing exists. Since photos don't change
 * meaningfully often (per Brendan: claimed listings get tradie-uploaded
 * photos instead anyway via /directory/manage, and unclaimed ones just
 * need an occasional refresh), downloading once and re-checking every
 * ~6 months is far cheaper than paying per view indefinitely.
 *
 * Selects listings by photos_cached_at (never cached, or cached more than
 * REFRESH_INTERVAL_DAYS ago) rather than a plain offset -- this is what
 * lets a modest, frequent cron give every listing an effective ~6-month
 * cadence without needing to sweep the entire directory in a single run,
 * which wouldn't fit in any reasonable function duration at this catalog
 * size (5,000+ listings).
 *
 * Skips claimed listings entirely -- once claimed, photos are the
 * tradie's own via /directory/manage, not Google's.
 */
export async function runCachePhotosBatch(): Promise<CachePhotosBatchResult> {
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY not configured");
  }

  const cutoff = new Date(Date.now() - REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();

  const { data: candidates, count } = await admin
    .from("directory_listing")
    .select("id, photo_references", { count: "exact" })
    .eq("is_claimed", false)
    .not("photo_references", "is", null)
    .or(`photos_cached_at.is.null,photos_cached_at.lt.${cutoff}`)
    .order("photos_cached_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  const total = count ?? 0;
  const results = { checked: 0, cached: 0, skippedNoPhotos: 0, failed: 0 };

  for (const row of candidates ?? []) {
    results.checked++;
    const refs = (row.photo_references ?? []) as string[];

    if (refs.length === 0) {
      results.skippedNoPhotos++;
      await admin.from("directory_listing").update({ photos_cached_at: new Date().toISOString() }).eq("id", row.id);
      continue;
    }

    const newRefs: string[] = [];
    let anyFailed = false;

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (ref.startsWith("http")) { newRefs.push(ref); continue; } // already cached from a prior partial run

      try {
        const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) { anyFailed = true; continue; }

        const contentType = res.headers.get("content-type") ?? "image/jpeg";
        const ext = contentType.includes("png") ? "png" : "jpg";
        const buffer = Buffer.from(await res.arrayBuffer());
        const path = `scraped/${row.id}/${i}.${ext}`;

        const { error: uploadErr } = await admin.storage
          .from("directory-photos")
          .upload(path, buffer, { upsert: true, contentType });

        if (uploadErr) { anyFailed = true; continue; }

        const { data: pub } = admin.storage.from("directory-photos").getPublicUrl(path);
        newRefs.push(pub.publicUrl);
      } catch {
        anyFailed = true;
      }
    }

    if (newRefs.length > 0) {
      await admin
        .from("directory_listing")
        .update({ photo_references: newRefs, photos_cached_at: new Date().toISOString() })
        .eq("id", row.id);
      results.cached++;
    } else {
      // Stamp it anyway so a listing whose photos all failed doesn't get
      // retried every single run -- it'll simply come up again in
      // another ~6 months, same as a successful one.
      await admin.from("directory_listing").update({ photos_cached_at: new Date().toISOString() }).eq("id", row.id);
    }
    if (anyFailed) results.failed++;
  }

  return {
    ...results,
    totalDue: total,
    remaining: Math.max(0, total - results.checked),
  };
}
