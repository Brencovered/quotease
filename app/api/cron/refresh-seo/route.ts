/**
 * GET /api/cron/refresh-seo
 * ---------------------------
 * Weekly automation (see vercel.json for schedule) -- see
 * lib/seo/refreshSeo.ts for what this actually does. This file is just
 * the cron-secret-gated entry point; the same logic is also reachable via
 * app/api/admin/seo/refresh for an on-demand admin trigger.
 *
 * AUTH: protected by CRON_SECRET. Vercel Cron calls this with
 * `Authorization: Bearer ${CRON_SECRET}` automatically once that env var
 * is set in the Vercel project AND referenced in vercel.json's cron config
 * -- without setting CRON_SECRET, this route will reject all requests
 * including Vercel's own, so don't forget that env var or the cron will
 * silently fail every run.
 *
 * ASSUMPTIONS / HONEST LIMITATIONS:
 * - Sitemap submission tries the real Search Console API first
 *   (lib/seo/searchConsole.ts) and only falls back to the legacy
 *   google.com/ping endpoint if that's not configured yet. Google
 *   deprecated the ping endpoint in mid-2023 -- it still returns 200 but
 *   does nothing. Until GOOGLE_SERVICE_ACCOUNT_KEY is set up, this run
 *   step is cosmetic.
 * - revalidatePath on every changed page works, but at scale (hundreds of
 *   suburbs) this could hit Vercel's revalidation rate limits in one run.
 *   Fine for current data volume; revisit (batch/stagger) before this
 *   table gets into the thousands of rows.
 */

import { NextResponse } from "next/server";
import { runSeoRefresh } from "@/lib/seo/refreshSeo";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[refresh-seo] CRON_SECRET is not set -- rejecting all requests, including Vercel's own cron trigger.");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSeoRefresh();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
