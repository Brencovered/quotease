import { NextResponse } from "next/server";
import { runCachePhotosBatch } from "@/lib/cachePhotosBatch";

// Runs weekly via Vercel cron -- each run only picks up listings whose
// photos_cached_at is null or older than ~6 months (see
// lib/cachePhotosBatch.ts), so this gives every listing an effective
// 6-monthly refresh cadence without ever needing to process the whole
// directory in one go.
export async function GET() {
  try {
    const result = await runCachePhotosBatch();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to cache photos" },
      { status: 500 }
    );
  }
}
