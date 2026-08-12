/**
 * GET /api/admin/activity
 * ------------------------
 * A readable activity feed, built from your own database events rather
 * than trying to re-display Vercel's raw request log.
 *
 * Why not just show the Vercel log: a busy site produces hundreds of rows
 * an hour that are entirely infrastructure (image prefetches, Googlebot
 * indexing photos, RSC payload fetches, your own server filling a
 * "similar listings" widget). Every one of those is a real log line and
 * none of them are an event a person would call "activity." This feed
 * only surfaces things that happened to your actual data: an account
 * created, a listing claimed or created, an attempt disputed. Each one is
 * a real thing you would want to know about, not a byproduct of how the
 * page renders.
 *
 * Bot vs human, done properly. There is no perfect way to tell a bot from
 * a person from a user agent string alone -- a sufficiently motivated bot
 * can claim to be Chrome on a Mac. What this does is name known,
 * verifiable crawler identities (Googlebot, Googlebot-Image, Bingbot, and
 * the handful of others that announce themselves honestly) as "bot", and
 * call everything else "human" by default. That is deliberately the safe
 * default: treating an unrecognised visitor as suspicious by default is
 * how a real tradie ends up flagged for using an unfamiliar browser.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

// Verified, self-identifying crawlers. Anything not on this list is
// treated as human, not because it is guaranteed to be, but because a
// false "bot" label actively misleads a manual fraud review, and a false
// "human" label just means it shows up in the feed for a second look.
const KNOWN_BOTS: { pattern: RegExp; label: string }[] = [
  { pattern: /googlebot-image/i, label: "Googlebot (images)" },
  { pattern: /googlebot/i, label: "Googlebot" },
  { pattern: /google-inspectiontool/i, label: "Google Search Console" },
  { pattern: /googleother/i, label: "GoogleOther" },
  { pattern: /bingbot/i, label: "Bingbot" },
  { pattern: /duckduckbot/i, label: "DuckDuckBot" },
  { pattern: /ahrefsbot/i, label: "AhrefsBot" },
  { pattern: /semrushbot/i, label: "SemrushBot" },
  { pattern: /facebookexternalhit/i, label: "Facebook link preview" },
  { pattern: /slackbot/i, label: "Slack link preview" },
  { pattern: /vercel-screenshot/i, label: "Vercel (internal)" },
];

function classify(userAgent: string | null): { kind: "bot" | "human" | "unknown"; label: string } {
  if (!userAgent) return { kind: "unknown", label: "No user agent" };
  const match = KNOWN_BOTS.find((b) => b.pattern.test(userAgent));
  if (match) return { kind: "bot", label: match.label };
  const device = /android/i.test(userAgent)
    ? "Android"
    : /iphone|ipad/i.test(userAgent)
    ? "iPhone/iPad"
    : /macintosh/i.test(userAgent)
    ? "Mac"
    : /windows/i.test(userAgent)
    ? "Windows"
    : /linux/i.test(userAgent)
    ? "Linux desktop"
    : "Unknown device";
  return { kind: "human", label: device };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  const admin = createAdminClient();

  // Two real event sources, merged and sorted. Both already exist; this
  // route does not create new tracking, it reads what PR #21 already
  // started writing.
  const [{ data: claims }, { data: signups }] = await Promise.all([
    admin
      .from("directory_claim_attempts")
      .select("id, attempted_business_name, suburb, trade, outcome, ip_address, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("profiles")
      .select("id, business_name, suburb, signup_ip, signup_user_agent, created_at")
      .not("created_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const events = [
    ...(claims ?? []).map((c) => {
      const { kind, label } = classify(c.user_agent);
      return {
        type: "claim" as const,
        outcome: c.outcome,
        business: c.attempted_business_name,
        suburb: c.suburb,
        trade: c.trade,
        ip: c.ip_address,
        deviceKind: kind,
        deviceLabel: label,
        at: c.created_at,
      };
    }),
    ...(signups ?? []).map((s) => {
      const { kind, label } = classify(s.signup_user_agent);
      return {
        type: "signup" as const,
        outcome: null,
        business: s.business_name,
        suburb: s.suburb,
        trade: null,
        ip: s.signup_ip,
        deviceKind: kind,
        deviceLabel: label,
        at: s.created_at,
      };
    }),
  ]
    .filter((e) => e.at)
    .sort((a, b) => new Date(b.at!).getTime() - new Date(a.at!).getTime())
    .slice(0, limit);

  // IPs seen more than once across this window -- the signal that actually
  // caught 103.78.46.30. Surfaced here rather than making the person spot
  // it by eye scrolling a list.
  const ipCounts = new Map<string, number>();
  for (const e of events) {
    if (!e.ip) continue;
    ipCounts.set(e.ip, (ipCounts.get(e.ip) ?? 0) + 1);
  }
  const repeatedIps = [...ipCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([ip, count]) => ({ ip, count }));

  return NextResponse.json({
    summary: {
      total: events.length,
      humans: events.filter((e) => e.deviceKind === "human").length,
      bots: events.filter((e) => e.deviceKind === "bot").length,
      unknown: events.filter((e) => e.deviceKind === "unknown").length,
    },
    repeatedIps,
    events,
  });
}
