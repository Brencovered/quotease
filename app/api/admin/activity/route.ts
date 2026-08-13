/**
 * GET /api/admin/activity
 * ------------------------
 * All real page-level traffic (not just signups/claims), for a genuinely
 * live view. Reads public.traffic_log, written by middleware.ts on every
 * page request it sees -- deliberately unfiltered, since the ask was
 * specifically to see bot traffic (Googlebot, crawlers, prefetches)
 * alongside real visitors, not a curated feed with the bots removed.
 *
 * An earlier version of this route read only directory_claim_attempts
 * and profiles (business-meaningful events), which filtered out exactly
 * the traffic this was meant to show. Replaced rather than kept
 * alongside it: two different "activity" endpoints returning different
 * things under similar names is worse than one that does what was asked.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);
  const sinceId = searchParams.get("sinceId");

  const admin = createAdminClient();

  let query = admin
    .from("traffic_log")
    .select("id, path, method, ip_address, user_agent, is_bot, bot_label, created_at")
    .order("id", { ascending: false })
    .limit(limit);

  if (sinceId) query = query.gt("id", Number(sinceId));

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = rows ?? [];

  const ipCounts = new Map<string, number>();
  for (const e of events) {
    if (!e.ip_address) continue;
    ipCounts.set(e.ip_address, (ipCounts.get(e.ip_address) ?? 0) + 1);
  }
  const repeatedIps = [...ipCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([ip, count]) => ({ ip, count }));

  return NextResponse.json({
    summary: {
      total: events.length,
      humans: events.filter((e) => !e.is_bot).length,
      bots: events.filter((e) => e.is_bot).length,
    },
    repeatedIps,
    events,
  });
}
