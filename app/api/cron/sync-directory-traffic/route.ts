/**
 * GET /api/cron/sync-directory-traffic
 * ---------------------------------------
 * Once daily, pulls yesterday's pageview/click counts from PostHog for
 * every claimed listing (see lib/directoryTrafficSync.ts) so the
 * tradie-facing traffic panel in Settings reads from a fast local
 * cache instead of calling PostHog live on every page load.
 *
 * Does nothing (logs why, returns ok:true with zero counts) until
 * POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID are both set - see
 * lib/posthogQuery.ts for what those are and how to get them. Safe to
 * merge and deploy before that setup is done; it just won't have
 * anything to show until it is.
 *
 * AUTH: protected by CRON_SECRET, same pattern as the other cron routes.
 */

import { NextResponse } from "next/server";
import { syncYesterdaysTraffic } from "@/lib/directoryTrafficSync";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[sync-directory-traffic] CRON_SECRET is not set - rejecting all requests, including Vercel's own cron trigger.");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncYesterdaysTraffic();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Traffic sync failed" },
      { status: 500 }
    );
  }
}
