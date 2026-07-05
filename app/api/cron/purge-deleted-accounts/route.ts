/**
 * GET /api/cron/purge-deleted-accounts
 * --------------------------------------
 * Daily automation (see vercel.json for schedule). Finds every profile
 * soft-deleted (deleted_at set, via /api/account/delete or
 * /api/admin/delete-account) more than 30 days ago and permanently
 * purges it: cancels any lingering Stripe subscription, cascades the
 * profile delete to quotes/clients/price book/everything, and removes
 * the Supabase Auth login. See lib/deleteAccount.ts for exactly what
 * purgeAccount touches.
 *
 * Runs one account at a time and keeps going even if one fails, so a
 * single bad record doesn't block the rest of the batch.
 *
 * AUTH: protected by CRON_SECRET, same pattern as the other cron routes
 * (see /api/cron/refresh-seo) -- Vercel Cron sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically once that env var
 * is set in the Vercel project and referenced in vercel.json.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { purgeAccount } from "@/lib/deleteAccount";

const GRACE_PERIOD_DAYS = 30;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[purge-deleted-accounts] CRON_SECRET is not set -- rejecting all requests, including Vercel's own cron trigger.");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 86400000).toISOString();

  const { data: dueForPurge, error } = await admin
    .from("profiles")
    .select("id, business_name, deleted_at")
    .not("deleted_at", "is", null)
    .lte("deleted_at", cutoff);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { profileId: string; businessName: string | null; ok: boolean; error?: string }[] = [];
  for (const profile of dueForPurge ?? []) {
    const result = await purgeAccount(profile.id);
    results.push({ profileId: profile.id, businessName: profile.business_name, ok: !result.error, error: result.error });
  }

  const purgedCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - purgedCount;
  if (failedCount > 0) {
    console.error("[purge-deleted-accounts] failures:", results.filter((r) => !r.ok));
  }

  return NextResponse.json({ checked: dueForPurge?.length ?? 0, purged: purgedCount, failed: failedCount, results });
}
