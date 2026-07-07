/**
 * GET /api/cron/check-xero-connections
 * --------------------------------------
 * Daily automation (see vercel.json for schedule). Xero access tokens
 * only last ~30 minutes and refresh tokens rotate on every use - if a
 * business only ever refreshes at the moment someone clicks "Push to
 * Xero", the very first thing they experience when a refresh happens
 * to fail (token already rotated by a race between two tabs/team
 * members, connection revoked on Xero's side, etc.) is a broken sync
 * click. That's a bad first impression of the integration and the
 * failure mode nobody should discover by accident.
 *
 * This proactively refreshes every connected business's token once a
 * day (well before the 30-minute access-token window matters, and
 * comfortably inside Xero's 60-day refresh-token idle limit), so:
 *   - Healthy connections stay warm and rotated, rather than sitting
 *     idle until a real sync attempt forces the first refresh in days.
 *   - A connection that's actually gone dead (revoked, expired,
 *     invalidated by a race) gets caught and cleared HERE, with the
 *     business notified via push straight away - not discovered by a
 *     customer mid-workflow when they go to push an invoice.
 *
 * Runs one business at a time and keeps going even if one fails, so a
 * single bad connection doesn't block the rest of the batch.
 *
 * AUTH: protected by CRON_SECRET, same pattern as the other cron routes.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToBusiness } from "@/lib/push";

const XERO_CLIENT_ID     = process.env.XERO_CLIENT_ID!;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET!;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[check-xero-connections] CRON_SECRET is not set -- rejecting all requests, including Vercel's own cron trigger.");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: connections, error } = await admin
    .from("profiles")
    .select("id, business_name, xero_refresh_token")
    .not("xero_tenant_id", "is", null)
    .not("xero_refresh_token", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { profileId: string; ok: boolean; error?: string }[] = [];

  for (const conn of connections ?? []) {
    try {
      const res = await fetch("https://identity.xero.com/connect/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type:    "refresh_token",
          refresh_token: conn.xero_refresh_token,
          client_id:     XERO_CLIENT_ID,
          client_secret: XERO_CLIENT_SECRET,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[check-xero-connections] refresh failed for ${conn.id}:`, res.status, body.slice(0, 300));

        await admin.from("profiles").update({
          xero_tenant_id:        null,
          xero_access_token:     null,
          xero_refresh_token:    null,
          xero_token_expires_at: null,
          xero_connected_at:     null,
        }).eq("id", conn.id);

        await sendPushToBusiness(admin, conn.id, {
          title: "Xero connection needs reconnecting",
          body: "Your Xero connection has expired. Reconnect in Settings to keep pushing invoices.",
          url: "/settings",
        }).catch(() => null);

        results.push({ profileId: conn.id, ok: false, error: `HTTP ${res.status}` });
        continue;
      }

      const tokens = await res.json();
      await admin.from("profiles").update({
        xero_access_token:     tokens.access_token,
        xero_refresh_token:    tokens.refresh_token ?? conn.xero_refresh_token,
        xero_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }).eq("id", conn.id);

      results.push({ profileId: conn.id, ok: true });
    } catch (err) {
      results.push({ profileId: conn.id, ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  const failedCount = results.filter((r) => !r.ok).length;
  if (failedCount > 0) {
    console.error("[check-xero-connections] failures:", results.filter((r) => !r.ok));
  }

  return NextResponse.json({
    checked: results.length,
    refreshed: results.filter((r) => r.ok).length,
    disconnected: failedCount,
    results,
  });
}
