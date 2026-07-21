import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const BATCH = 50; // per single invocation -- call repeatedly to drain backlog

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (!GOOGLE_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY not set" }, { status: 500 });
  }

  const admin = createAdminClient();

  // Get listings with uncached photo refs (tokens, not URLs)
  const { data: listings, count } = await admin
    .from("directory_listing")
    .select("id, photo_references", { count: "exact" })
    .eq("is_claimed", false)
    .or("photos_cached_at.is.null,photos_cached_at.lt.2020-01-01")
    .order("photos_cached_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);

  // Count truly uncached (token refs, not http)
  const total = count ?? 0;
  const results = { processed: 0, cached: 0, skipped: 0, failed: 0, remaining: total };

  for (const row of listings ?? []) {
    results.processed++;
    const refs = (row.photo_references ?? []) as string[];
    const uncached = refs.filter(r => !r.startsWith("http"));

    if (uncached.length === 0) {
      // Already cached -- just stamp it
      await admin.from("directory_listing")
        .update({ photos_cached_at: new Date().toISOString() })
        .eq("id", row.id);
      results.skipped++;
      continue;
    }

    const newRefs: string[] = refs.filter(r => r.startsWith("http")); // keep existing cached
    let anyFailed = false;

    for (let i = 0; i < uncached.length; i++) {
      const ref = uncached[i];
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

    await admin.from("directory_listing")
      .update({ photo_references: newRefs, photos_cached_at: new Date().toISOString() })
      .eq("id", row.id);

    if (anyFailed) results.failed++;
    else results.cached++;
  }

  results.remaining = Math.max(0, total - results.processed);

  return NextResponse.json(results);
}
