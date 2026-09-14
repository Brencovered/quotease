import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHogQLQuery } from "@/lib/posthogQuery";
import { TrendingUp, Users, FileText, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Admin overview page - combined site traffic summary (live PostHog
 * queries - this page is viewed by one admin occasionally, not
 * hundreds of tradies, so unlike the per-listing traffic dashboard
 * (Settings), there's no need for a caching/cron layer here) and
 * directory growth activity (listings, claims, scraper pipeline
 * status), in one place rather than scattered across the Activity,
 * Directory, and website-scraper admin pages.
 *
 * Each section fetches independently and degrades gracefully - a
 * failed PostHog query (e.g. the personal API key isn't configured
 * yet) shows an inline error in that section only, not a broken page.
 */

interface SiteTrafficStats {
  sessions: number;
  bounceRate: number;
  pageviews: number;
  topPages: { path: string; sessions: number }[];
  channels: { channel: string; sessions: number }[];
}

async function getSiteTraffic(): Promise<SiteTrafficStats | null> {
  const [overview, topPages, channels] = await Promise.all([
    runHogQLQuery(`
      SELECT count() AS sessions, avg($is_bounce) AS bounce_rate, sum($pageview_count) AS pageviews
      FROM sessions
      WHERE $start_timestamp >= now() - INTERVAL 7 DAY
    `),
    runHogQLQuery(`
      SELECT $entry_pathname AS path, count() AS sessions
      FROM sessions
      WHERE $start_timestamp >= now() - INTERVAL 7 DAY AND $entry_pathname IS NOT NULL
      GROUP BY path
      ORDER BY sessions DESC
      LIMIT 10
    `),
    runHogQLQuery(`
      SELECT $channel_type AS channel, count() AS sessions
      FROM sessions
      WHERE $start_timestamp >= now() - INTERVAL 7 DAY
      GROUP BY channel
      ORDER BY sessions DESC
      LIMIT 8
    `),
  ]);

  if (!overview || !topPages || !channels) return null;

  const [sessions, bounceRate, pageviews] = overview.results[0] ?? [0, 0, 0];

  return {
    sessions: Number(sessions) || 0,
    bounceRate: Number(bounceRate) || 0,
    pageviews: Number(pageviews) || 0,
    topPages: topPages.results.map(r => ({ path: String(r[0]), sessions: Number(r[1]) })),
    channels: channels.results.map(r => ({ channel: String(r[0] ?? "Unknown"), sessions: Number(r[1]) })),
  };
}

interface DirectoryActivity {
  totalListings: number;
  claimedListings: number;
  newListingsLast7d: number;
  newListingsLast30d: number;
  recentClaims: { businessName: string; suburb: string | null; claimedAt: string }[];
  abn: { totalCandidates: number; unprocessed: number; listingsCreated: number };
}

async function getDirectoryActivity(): Promise<DirectoryActivity> {
  const admin = createAdminClient();

  const [
    { count: totalListings },
    { count: claimedListings },
    { count: newLast7d },
    { count: newLast30d },
    { data: recentClaimRows },
    { count: abnTotal },
    { count: abnUnprocessed },
    { count: abnListingsCreated },
  ] = await Promise.all([
    admin.from("directory_listing").select("id", { count: "exact", head: true }),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).eq("is_claimed", true),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    admin.from("directory_listing").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    // No dedicated claimed_at column - the associated profile's
    // creation date is the closest real signal (a profile is created
    // as part of claiming), same approach used to verify a specific
    // claim earlier in this session. Sorted in JS rather than via a
    // nested .order() on the embedded profiles relation, which
    // PostgREST's JS client doesn't reliably support.
    admin.from("directory_listing")
      .select("business_name, suburb, profiles!directory_listing_profile_id_fkey(created_at)")
      .eq("is_claimed", true)
      .not("profile_id", "is", null)
      .limit(50),
    admin.from("abn_trade_candidates").select("id", { count: "exact", head: true }),
    admin.from("abn_trade_candidates").select("id", { count: "exact", head: true }).is("processed_at", null),
    admin.from("abn_trade_candidates").select("id", { count: "exact", head: true }).not("directory_listing_id", "is", null),
  ]);

  const recentClaims = (recentClaimRows ?? [])
    .map((r) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        businessName: r.business_name as string,
        suburb: r.suburb as string | null,
        claimedAt: (profile as { created_at?: string } | null)?.created_at ?? "",
      };
    })
    .filter(c => c.claimedAt)
    .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))
    .slice(0, 5);

  return {
    totalListings: totalListings ?? 0,
    claimedListings: claimedListings ?? 0,
    newListingsLast7d: newLast7d ?? 0,
    newListingsLast30d: newLast30d ?? 0,
    recentClaims,
    abn: {
      totalCandidates: abnTotal ?? 0,
      unprocessed: abnUnprocessed ?? 0,
      listingsCreated: abnListingsCreated ?? 0,
    },
  };
}

export default async function AdminOverviewPage() {
  const [traffic, directory] = await Promise.all([
    getSiteTraffic(),
    getDirectoryActivity(),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-5 py-8 space-y-8">
      <div>
        <h1 className="font-display text-[1.8rem] text-[var(--ink)]">Overview</h1>
        <p className="text-[13.5px] text-[var(--ink-faint)] mt-1">Site traffic and directory growth, last 7 days</p>
      </div>

      {/* Site traffic */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-[var(--amber)]" />
          <h2 className="font-display text-[1.3rem] text-[var(--ink)]">Site traffic</h2>
        </div>

        {!traffic ? (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-amber-800">
              Couldn&apos;t load traffic data - check POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID are set,
              and check Vercel logs for [posthogQuery] for the specific error.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="card">
                <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">Sessions</p>
                <p className="font-display text-[1.8rem] text-[var(--ink)]">{traffic.sessions.toLocaleString()}</p>
              </div>
              <div className="card">
                <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">Bounce rate</p>
                <p className="font-display text-[1.8rem] text-[var(--ink)]">{(traffic.bounceRate * 100).toFixed(0)}%</p>
              </div>
              <div className="card">
                <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">Pageviews</p>
                <p className="font-display text-[1.8rem] text-[var(--ink)]">{traffic.pageviews.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="card">
                <p className="section-tag mb-3">Top pages</p>
                <div className="space-y-1.5">
                  {traffic.topPages.map((p) => (
                    <div key={p.path} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-[var(--ink-soft)] font-mono truncate mr-3">{p.path}</span>
                      <span className="font-bold text-[var(--ink)] shrink-0">{p.sessions}</span>
                    </div>
                  ))}
                  {traffic.topPages.length === 0 && <p className="text-[12px] text-[var(--ink-faint)]">No data</p>}
                </div>
              </div>

              <div className="card">
                <p className="section-tag mb-3">By channel</p>
                <div className="space-y-1.5">
                  {traffic.channels.map((c) => (
                    <div key={c.channel} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-[var(--ink-soft)]">{c.channel}</span>
                      <span className="font-bold text-[var(--ink)]">{c.sessions}</span>
                    </div>
                  ))}
                  {traffic.channels.length === 0 && <p className="text-[12px] text-[var(--ink-faint)]">No data</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Directory growth */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[var(--amber)]" />
          <h2 className="font-display text-[1.3rem] text-[var(--ink)]">Directory growth</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card">
            <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">Total listings</p>
            <p className="font-display text-[1.8rem] text-[var(--ink)]">{directory.totalListings.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">Claimed</p>
            <p className="font-display text-[1.8rem] text-[var(--ink)]">{directory.claimedListings.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">New (7d)</p>
            <p className="font-display text-[1.8rem] text-green-600">+{directory.newListingsLast7d}</p>
          </div>
          <div className="card">
            <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">New (30d)</p>
            <p className="font-display text-[1.8rem] text-green-600">+{directory.newListingsLast30d}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card">
            <p className="section-tag mb-3">Recent claims</p>
            <div className="space-y-2">
              {directory.recentClaims.map((c, i) => (
                <div key={i} className="text-[12.5px]">
                  <span className="font-semibold text-[var(--ink)]">{c.businessName}</span>
                  {c.suburb && <span className="text-[var(--ink-faint)]"> - {c.suburb}</span>}
                </div>
              ))}
              {directory.recentClaims.length === 0 && <p className="text-[12px] text-[var(--ink-faint)]">No claims yet</p>}
            </div>
          </div>

          <div className="card">
            <p className="section-tag mb-3">ABN pipeline</p>
            <div className="space-y-1.5 text-[12.5px]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--ink-soft)]">Candidates queued</span>
                <span className="font-bold text-[var(--ink)]">{directory.abn.totalCandidates}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--ink-soft)]">Awaiting processing</span>
                <span className="font-bold text-amber-600">{directory.abn.unprocessed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--ink-soft)]">Listings created</span>
                <span className="font-bold text-green-600">{directory.abn.listingsCreated}</span>
              </div>
            </div>
            <Link href="/admin/website-scraper" className="inline-block mt-3 text-[12px] font-semibold text-[var(--navy)] hover:underline">
              Manage in website scraper →
            </Link>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-[var(--app-bg)] rounded-xl px-4 py-3">
          <FileText size={14} className="text-[var(--ink-faint)] shrink-0 mt-0.5" />
          <p className="text-[12px] text-[var(--ink-faint)]">
            Yellow Pages expansion is paused (confirmed IP-blocked by Yellow Pages&apos; servers) -
            ABN Bulk Extract is the active free growth path. See website scraper for both.
          </p>
        </div>
      </section>
    </div>
  );
}
