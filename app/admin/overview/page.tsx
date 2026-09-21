import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHogQLQuery } from "@/lib/posthogQuery";
import { TrendingUp, Users, FileText, AlertTriangle, Mail, Search } from "lucide-react";
import OutreachPriorityPanel from "@/components/admin/OutreachPriorityPanel";

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
 *
 * The full directory_listing table (lightweight columns) is fetched
 * once via getListingLookup() and shared across every section that
 * needs to match a PostHog path to a real business, rather than each
 * section re-fetching all ~4,900 rows independently.
 */

interface ListingRecord {
  id: string;
  businessName: string;
  suburb: string | null;
  isClaimed: boolean;
  googleRating: number | null;
  googleReviewsCount: number | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
}

async function getListingLookup(): Promise<Map<string, ListingRecord>> {
  const admin = createAdminClient();
  // Matching a hex suffix against `id` (a uuid column) via PostgREST's
  // raw LIKE filter has real casting risk unverifiable without a live
  // deployment to test against - fetching the full lightweight table
  // once and matching in JS avoids that ambiguity entirely. Explicit
  // .limit() because Supabase's default row cap (commonly 1000) would
  // otherwise silently truncate this well below the real ~4,900 total.
  //
  // email is the coalesced value send-claim-invite itself checks
  // (scraped_contact_email || private_email) - fetched here too so the
  // dashboard can tell in advance which candidates are actually
  // emailable, rather than offering to send and having some silently
  // no-op via that route's own skippedNoEmail path.
  const { data } = await admin
    .from("directory_listing")
    .select("id, business_name, suburb, is_claimed, google_rating, google_reviews_count, scraped_contact_phone, scraped_contact_email, private_email, website_url")
    .limit(10000);

  const bySuffix = new Map<string, ListingRecord>();
  for (const l of data ?? []) {
    const suffix = (l.id as string).replace(/-/g, "").slice(-6);
    bySuffix.set(suffix, {
      id: l.id as string,
      businessName: l.business_name as string,
      suburb: l.suburb as string | null,
      isClaimed: l.is_claimed as boolean,
      googleRating: l.google_rating as number | null,
      googleReviewsCount: l.google_reviews_count as number | null,
      phone: l.scraped_contact_phone as string | null,
      email: (l.scraped_contact_email as string | null) ?? (l.private_email as string | null),
      websiteUrl: l.website_url as string | null,
    });
  }
  return bySuffix;
}

function suffixFromPath(path: string): string | null {
  const match = path.match(/^\/directory\/.+-([0-9a-f]{6})$/);
  return match ? match[1] : null;
}

interface SiteTrafficStats {
  sessions: number;
  bounceRate: number;
  pageviews: number;
  topPages: { path: string; sessions: number; bounceRate: number }[];
  channels: { channel: string; sessions: number }[];
  referrers: { referrer: string; sessions: number }[];
  trend: { day: string; sessions: number }[];
}

async function getSiteTraffic(): Promise<SiteTrafficStats | null> {
  const [overview, topPages, channels, referrers, trend] = await Promise.all([
    runHogQLQuery(`
      SELECT count() AS sessions, avg($is_bounce) AS bounce_rate, sum($pageview_count) AS pageviews
      FROM sessions
      WHERE $start_timestamp >= now() - INTERVAL 7 DAY
    `),
    runHogQLQuery(`
      SELECT $entry_pathname AS path, count() AS sessions, avg($is_bounce) AS bounce_rate
      FROM sessions
      WHERE $start_timestamp >= now() - INTERVAL 7 DAY AND $entry_pathname IS NOT NULL
      GROUP BY path
      ORDER BY sessions DESC
      LIMIT 15
    `),
    runHogQLQuery(`
      SELECT $channel_type AS channel, count() AS sessions
      FROM sessions
      WHERE $start_timestamp >= now() - INTERVAL 7 DAY
      GROUP BY channel
      ORDER BY sessions DESC
      LIMIT 8
    `),
    runHogQLQuery(`
      SELECT $entry_referring_domain AS referrer, count() AS sessions
      FROM sessions
      WHERE $start_timestamp >= now() - INTERVAL 7 DAY
        AND $entry_referring_domain IS NOT NULL AND $entry_referring_domain != ''
      GROUP BY referrer
      ORDER BY sessions DESC
      LIMIT 12
    `),
    runHogQLQuery(`
      SELECT toDate($start_timestamp) AS day, count() AS sessions
      FROM sessions
      WHERE $start_timestamp >= now() - INTERVAL 30 DAY
      GROUP BY day
      ORDER BY day ASC
    `),
  ]);

  if (!overview || !topPages || !channels || !referrers || !trend) return null;

  const [sessions, bounceRate, pageviews] = overview.results[0] ?? [0, 0, 0];

  return {
    sessions: Number(sessions) || 0,
    bounceRate: Number(bounceRate) || 0,
    pageviews: Number(pageviews) || 0,
    topPages: topPages.results.map(r => ({ path: String(r[0]), sessions: Number(r[1]), bounceRate: Number(r[2]) || 0 })),
    channels: channels.results.map(r => ({ channel: String(r[0] ?? "Unknown"), sessions: Number(r[1]) })),
    referrers: referrers.results.map(r => ({ referrer: String(r[0]), sessions: Number(r[1]) })),
    trend: trend.results.map(r => ({ day: String(r[0]), sessions: Number(r[1]) })),
  };
}

interface TopDirectoryListing {
  path: string;
  sessions: number;
  bounceRate: number;
  businessName: string | null;
  suburb: string | null;
  isClaimed: boolean | null;
}

async function getTopDirectoryListings(lookup: Map<string, ListingRecord>): Promise<TopDirectoryListing[]> {
  const result = await runHogQLQuery(`
    SELECT $entry_pathname AS path, count() AS sessions, avg($is_bounce) AS bounce_rate
    FROM sessions
    WHERE $start_timestamp >= now() - INTERVAL 7 DAY
      AND $entry_pathname LIKE '/directory/%'
      AND $entry_pathname != '/directory/claim'
      AND $entry_pathname != '/directory'
    GROUP BY path
    ORDER BY sessions DESC
    LIMIT 20
  `);

  if (!result) return [];

  return result.results.map((r) => {
    const path = String(r[0]);
    const sessions = Number(r[1]);
    const bounceRate = Number(r[2]) || 0;
    const suffix = suffixFromPath(path);
    const match = suffix ? lookup.get(suffix) : undefined;
    return {
      path, sessions, bounceRate,
      businessName: match?.businessName ?? null,
      suburb: match?.suburb ?? null,
      isClaimed: match?.isClaimed ?? null,
    };
  });
}

interface OutreachCandidate {
  id: string;
  businessName: string;
  suburb: string | null;
  sessions: number;
  googleRating: number | null;
  googleReviewsCount: number | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
}

/**
 * The actual point of pairing traffic data with directory data: which
 * unclaimed, credible (real Google review history) businesses are
 * getting real, verified visibility on the site right now, ranked so
 * the most convincing ones (most reviews - the same signal used for
 * manual outreach prioritisation earlier) surface first, with contact
 * details right there rather than needing a separate lookup to act on
 * it. Uses a wider 30-day traffic window than the 7-day "Top directory
 * listings" section above - outreach prioritisation cares about "has
 * this business shown any real traffic recently", not a tight recency
 * window.
 */
async function getOutreachCandidates(lookup: Map<string, ListingRecord>): Promise<OutreachCandidate[]> {
  const result = await runHogQLQuery(`
    SELECT $entry_pathname AS path, count() AS sessions
    FROM sessions
    WHERE $start_timestamp >= now() - INTERVAL 30 DAY
      AND $entry_pathname LIKE '/directory/%'
      AND $entry_pathname != '/directory/claim'
      AND $entry_pathname != '/directory'
    GROUP BY path
    ORDER BY sessions DESC
    LIMIT 60
  `);

  if (!result) return [];

  const sessionsBySuffix = new Map<string, number>();
  for (const r of result.results) {
    const path = String(r[0]);
    const suffix = suffixFromPath(path);
    if (suffix) sessionsBySuffix.set(suffix, (sessionsBySuffix.get(suffix) ?? 0) + Number(r[1]));
  }

  const candidates: OutreachCandidate[] = [];
  for (const [suffix, sessions] of sessionsBySuffix) {
    const listing = lookup.get(suffix);
    if (!listing || listing.isClaimed || !listing.googleReviewsCount) continue;
    candidates.push({
      id: listing.id,
      businessName: listing.businessName,
      suburb: listing.suburb,
      sessions,
      googleRating: listing.googleRating,
      googleReviewsCount: listing.googleReviewsCount,
      phone: listing.phone,
      email: listing.email,
      websiteUrl: listing.websiteUrl,
    });
  }

  return candidates
    .sort((a, b) => (b.googleReviewsCount ?? 0) - (a.googleReviewsCount ?? 0))
    .slice(0, 10);
}

function safeDecodeSearchTerm(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    // malformed URL encoding (e.g. a lone "%") shouldn't take down the
    // whole page render - fall back to the raw value
    return raw.replace(/\+/g, " ");
  }
}

interface TopSearches {
  postcodes: { postcode: string; searches: number }[];
  trades: { trade: string; searches: number }[];
  recentTerms: string[];
}

/**
 * What people are actually searching for on /directory - postcodes,
 * trades, and free-text terms. Uses ClickHouse's extractURLParameter()
 * directly on $current_url rather than a dedicated search event,
 * since the search form updates the URL via client-side routing and
 * every route change already fires a $pageview with the full query
 * string (confirmed real data before building this - see commit
 * message).
 *
 * recentTerms is deliberately NOT ranked as "top" the way postcodes/
 * trades are: the free-text search box fires a URL update on every
 * keystroke (confirmed in real data - "Lime", "Lime+p", "Lime+pl",
 * "Lime+plu"... all appear as separate entries for one person typing
 * one query), so ranking fragments by count would be misleading.
 * Shown as a simple recent list instead, decoded from URL encoding.
 */
async function getTopSearches(): Promise<TopSearches | null> {
  const [postcodes, trades, terms] = await Promise.all([
    runHogQLQuery(`
      SELECT extractURLParameter(properties.$current_url, 'postcode') AS postcode, count() AS searches
      FROM events
      WHERE event = '$pageview' AND properties.$pathname = '/directory'
        AND properties.$current_url LIKE '%postcode=%'
        AND timestamp >= now() - INTERVAL 30 DAY
      GROUP BY postcode
      HAVING postcode != ''
      ORDER BY searches DESC
      LIMIT 15
    `),
    runHogQLQuery(`
      SELECT extractURLParameter(properties.$current_url, 'trade') AS trade, count() AS searches
      FROM events
      WHERE event = '$pageview' AND properties.$pathname = '/directory'
        AND properties.$current_url LIKE '%trade=%'
        AND timestamp >= now() - INTERVAL 30 DAY
      GROUP BY trade
      HAVING trade != ''
      ORDER BY searches DESC
      LIMIT 15
    `),
    runHogQLQuery(`
      SELECT extractURLParameter(properties.$current_url, 'search') AS term, max(timestamp) AS last_seen
      FROM events
      WHERE event = '$pageview' AND properties.$pathname = '/directory'
        AND properties.$current_url LIKE '%search=%'
        AND timestamp >= now() - INTERVAL 30 DAY
      GROUP BY term
      HAVING term != ''
      ORDER BY last_seen DESC
      LIMIT 15
    `),
  ]);

  if (!postcodes || !trades || !terms) return null;

  return {
    postcodes: postcodes.results.map(r => ({ postcode: String(r[0]), searches: Number(r[1]) })),
    trades: trades.results.map(r => ({ trade: String(r[0]), searches: Number(r[1]) })),
    recentTerms: terms.results.map(r => safeDecodeSearchTerm(String(r[0]))),
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
  const lookup = await getListingLookup();
  const [traffic, topListings, outreachCandidates, topSearches, directory] = await Promise.all([
    getSiteTraffic(),
    getTopDirectoryListings(lookup),
    getOutreachCandidates(lookup),
    getTopSearches(),
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

            {/* 30-day trend - the single 7-day snapshot above says
                nothing about direction (growing, flat, declining).
                Simple bar trend, same visual pattern used for the
                tradie-facing traffic panel in Settings. */}
            <div className="card">
              <p className="section-tag mb-3">Sessions, last 30 days</p>
              <div className="flex items-end gap-[3px] h-16">
                {(() => {
                  const max = Math.max(...traffic.trend.map(t => t.sessions), 1);
                  return traffic.trend.map((d) => (
                    <div
                      key={d.day}
                      title={`${d.day}: ${d.sessions} session${d.sessions !== 1 ? "s" : ""}`}
                      className="flex-1 bg-[var(--amber)] rounded-t min-h-[2px]"
                      style={{ height: `${Math.max((d.sessions / max) * 100, 3)}%` }}
                    />
                  ));
                })()}
                {traffic.trend.length === 0 && <p className="text-[12px] text-[var(--ink-faint)]">No data</p>}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="card">
                <p className="section-tag mb-3">Top pages</p>
                <div className="space-y-1.5">
                  {traffic.topPages.map((p) => (
                    <div key={p.path} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-[var(--ink-soft)] font-mono truncate mr-3">{p.path}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-[var(--ink-faint)]">{(p.bounceRate * 100).toFixed(0)}% bounce</span>
                        <span className="font-bold text-[var(--ink)]">{p.sessions}</span>
                      </span>
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

              <div className="card">
                <p className="section-tag mb-3">By referrer</p>
                <div className="space-y-1.5">
                  {traffic.referrers.map((r) => (
                    <div key={r.referrer} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-[var(--ink-soft)] truncate mr-3">{r.referrer === "$direct" ? "Direct" : r.referrer}</span>
                      <span className="font-bold text-[var(--ink)] shrink-0">{r.sessions}</span>
                    </div>
                  ))}
                  {traffic.referrers.length === 0 && <p className="text-[12px] text-[var(--ink-faint)]">No data</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Top directory listings - which specific businesses are getting
          traffic, resolved to real names/suburbs/claim status rather
          than raw slugs. Directly actionable: an unclaimed listing
          getting real traffic is an outreach target (see the
          website-scraper admin page's ABN/expansion panels for the
          growth side of this); a claimed listing with a high bounce
          rate is worth a look at the listing itself. */}
      {traffic && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[var(--amber)]" />
            <h2 className="font-display text-[1.3rem] text-[var(--ink)]">Top directory listings</h2>
          </div>
          <div className="card">
            {topListings.length === 0 ? (
              <p className="text-[12.5px] text-[var(--ink-faint)]">No listing traffic in the last 7 days</p>
            ) : (
              <div className="space-y-2">
                {topListings.map((l) => (
                  <div key={l.path} className="flex items-center justify-between gap-3 text-[12.5px] py-1 border-b border-[var(--line)] last:border-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--ink)] truncate">{l.businessName ?? l.path}</span>
                        {l.isClaimed === false && (
                          <span className="shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Unclaimed
                          </span>
                        )}
                        {l.isClaimed === true && (
                          <span className="shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">
                            Claimed
                          </span>
                        )}
                      </div>
                      {l.suburb && <p className="text-[11px] text-[var(--ink-faint)]">{l.suburb}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-[var(--ink-faint)]">{(l.bounceRate * 100).toFixed(0)}% bounce</span>
                      <span className="font-bold text-[var(--ink)]">{l.sessions}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Outreach priority - the actual point of pairing traffic with
          directory data: unclaimed, credible (real Google review
          history) businesses getting real traffic right now, ranked
          by review count (the same signal used for manual outreach
          prioritisation earlier), with contact details right here so
          this list is directly actionable rather than needing a
          separate lookup before reaching out.
          Client component (OutreachPriorityPanel) so it can wire
          directly to the existing /api/admin/directory/send-claim-
          invite endpoint - one click sends real, personalised, tracked
          claim invites to this specific high-value segment instead of
          a manual CSV export -> HubSpot import round trip. Deliberately
          keeps that click as a real, manual trigger rather than
          sending automatically - this sends real email to real
          businesses, worth a person deciding each time, not something
          to run unattended. */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-[var(--amber)]" />
          <h2 className="font-display text-[1.3rem] text-[var(--ink)]">Outreach priority</h2>
        </div>
        <p className="text-[12.5px] text-[var(--ink-faint)] -mt-2">
          Unclaimed listings with real Google reviews getting traffic in the last 30 days, most-reviewed first
        </p>
        <OutreachPriorityPanel candidates={outreachCandidates} />
      </section>

      {/* Top searches - what people are actually typing into the
          directory search form, not just which pages they land on.
          Extracted directly from the search form's URL query params
          via ClickHouse's extractURLParameter() (confirmed real data
          before building this - see commit message) rather than a
          dedicated search-tracking event, since the search form
          already updates the URL on every change and each of those
          already fires a $pageview. Postcodes with real search
          volume but thin listing coverage are a concrete expansion-
          priority signal, separate from the outreach-priority list
          above (which is about existing listings, not coverage gaps). */}
      {topSearches && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Search size={18} className="text-[var(--amber)]" />
            <h2 className="font-display text-[1.3rem] text-[var(--ink)]">Top searches</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="card">
              <p className="section-tag mb-3">Postcodes (30d)</p>
              <div className="space-y-1.5">
                {topSearches.postcodes.map((p) => (
                  <div key={p.postcode} className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[var(--ink-soft)] font-mono">{p.postcode}</span>
                    <span className="font-bold text-[var(--ink)]">{p.searches}</span>
                  </div>
                ))}
                {topSearches.postcodes.length === 0 && <p className="text-[12px] text-[var(--ink-faint)]">No data</p>}
              </div>
            </div>

            <div className="card">
              <p className="section-tag mb-3">Trades (30d)</p>
              <div className="space-y-1.5">
                {topSearches.trades.map((t) => (
                  <div key={t.trade} className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[var(--ink-soft)] capitalize">{t.trade}</span>
                    <span className="font-bold text-[var(--ink)]">{t.searches}</span>
                  </div>
                ))}
                {topSearches.trades.length === 0 && <p className="text-[12px] text-[var(--ink-faint)]">No data</p>}
              </div>
            </div>

            <div className="card">
              <p className="section-tag mb-3">Recent search terms</p>
              <div className="space-y-1.5">
                {topSearches.recentTerms.map((term, i) => (
                  <p key={i} className="text-[12.5px] text-[var(--ink-soft)] truncate">{term}</p>
                ))}
                {topSearches.recentTerms.length === 0 && <p className="text-[12px] text-[var(--ink-faint)]">No data</p>}
              </div>
              <p className="text-[10.5px] text-[var(--ink-faint)] mt-2">
                Recent, not ranked - the search box updates on every keystroke
              </p>
            </div>
          </div>
        </section>
      )}

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
