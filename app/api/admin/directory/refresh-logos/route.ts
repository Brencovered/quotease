import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { extractLogoUrl, fetchWebsiteHtml } from "@/app/api/admin/scrape/route";

export const maxDuration = 60;

const BATCH_SIZE = 25;

/**
 * Re-extracts logo_url for existing listings using the corrected priority
 * order (extractLogoUrl in ../scrape/route.ts) -- built for the ~500
 * listings scraped just before that fix landed, which picked up a generic
 * og:image (a hero/content photo) instead of an actual logo.
 *
 * Deliberately does NOT re-run the Google Places Nearby Search/Place
 * Details steps -- those already have good data (rating, photos, etc.) and
 * cost real API credits per call. This only re-fetches each business's own
 * website (free) and re-runs the logo detection, updating logo_url when a
 * better one is found.
 *
 * Processes one bounded batch per call (BATCH_SIZE) rather than all
 * matching rows at once, to stay well inside Vercel's function duration --
 * the client is expected to keep calling this with an increasing `offset`
 * until `remaining` is 0.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: { sinceHours?: number; offset?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sinceHours = body.sinceHours && body.sinceHours > 0 ? body.sinceHours : 24;
  const offset = body.offset && body.offset > 0 ? body.offset : 0;
  const sinceIso = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();

  const { data: candidates, count } = await admin
    .from("directory_listing")
    .select("id, website_url, logo_url", { count: "exact" })
    .not("website_url", "is", null)
    .gte("created_at", sinceIso)
    .order("id", { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);

  const total = count ?? 0;
  const results = { checked: 0, updated: 0, unchanged: 0, failed: 0 };

  for (const row of candidates ?? []) {
    results.checked++;
    try {
      const html = await fetchWebsiteHtml(row.website_url!);
      if (!html) { results.failed++; continue; }

      const newLogoUrl = extractLogoUrl(html, row.website_url!);
      if (newLogoUrl !== row.logo_url) {
        await admin.from("directory_listing").update({ logo_url: newLogoUrl }).eq("id", row.id);
        results.updated++;
      } else {
        results.unchanged++;
      }
    } catch {
      results.failed++;
    }
  }

  const nextOffset = offset + BATCH_SIZE;
  return NextResponse.json({
    ...results,
    total,
    nextOffset,
    remaining: Math.max(0, total - nextOffset),
  });
}
