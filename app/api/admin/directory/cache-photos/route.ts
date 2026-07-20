import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { runCachePhotosBatch } from "@/lib/cachePhotosBatch";

export const maxDuration = 60;

/**
 * Admin-triggered version of the photo-caching batch (see
 * lib/cachePhotosBatch.ts for the full explanation). Same logic the
 * weekly cron (app/api/cron/cache-photos) runs automatically -- this is
 * just for running it on demand from /admin/scraper rather than waiting
 * for the next scheduled run.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const result = await runCachePhotosBatch();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to cache photos" },
      { status: 500 }
    );
  }
}
