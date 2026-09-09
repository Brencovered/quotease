import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { runHogQL } from "@/lib/posthog-server";

// Live traffic dashboard - never cache at any layer.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Sessions under this length are mostly bounces, prefetches, and bot
// noise - filtering them out is what makes the "real visitor" numbers on
// this page match what we've manually checked in PostHog directly.
const MIN_SESSION_SECONDS = 15;
const WINDOW_DAYS = 30;

// Shared CTE every query below builds on: qualifying sessions in the
// window, with a resolved entry source so we're not repeating the same
// coalesce logic five times.
const QUALIFYING_SESSIONS = `
  qualifying_sessions AS (
    SELECT
        session_id,
        $session_duration AS duration,
        coalesce(nullIf($entry_utm_source, ''), nullIf($entry_referring_domain, ''), 'direct') AS source
    FROM sessions
    WHERE $session_duration > ${MIN_SESSION_SECONDS}
      AND $start_timestamp >= now() - INTERVAL ${WINDOW_DAYS} DAY
  )
`;

type OverviewRow = {
  total_pageviews: number;
  total_sessions: number;
  unique_visitors: number;
  distinct_pages: number;
  avg_session_duration_sec: number;
};

type SourceRow = { source: string; sessions: number };
type CountryRow = { country: string | null; sessions: number };
type PageRow = {
  page: string;
  pageviews: number;
  sessions: number;
  unique_visitors: number;
  avg_session_duration_sec: number;
  top_source: string;
  top_country: string | null;
};

export async function GET() {
  const authClient = await createClient();
  const { data: userData } = await authClient.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  try {
    const [overview, sources, countries, topPages, topTradiePages] = await Promise.all([
      // --- Overview cards --------------------------------------------
      runHogQL<OverviewRow>(`
        WITH ${QUALIFYING_SESSIONS}
        SELECT
            count() AS total_pageviews,
            uniq(e.$session_id) AS total_sessions,
            uniq(e.person_id) AS unique_visitors,
            uniq(e.properties.$pathname) AS distinct_pages,
            round(avg(least(qs.duration, 1800)), 1) AS avg_session_duration_sec
        FROM events AS e
        JOIN qualifying_sessions AS qs ON qs.session_id = e.$session_id
        WHERE e.event = '$pageview'
          AND e.timestamp >= now() - INTERVAL ${WINDOW_DAYS} DAY
      `),

      // --- Entry / traffic sources -------------------------------------
      runHogQL<SourceRow>(`
        WITH ${QUALIFYING_SESSIONS},
        dir_sessions AS (
            SELECT DISTINCT $session_id AS session_id
            FROM events
            WHERE event = '$pageview'
              AND timestamp >= now() - INTERVAL ${WINDOW_DAYS} DAY
        )
        SELECT qs.source AS source, count() AS sessions
        FROM dir_sessions
        JOIN qualifying_sessions AS qs ON qs.session_id = dir_sessions.session_id
        GROUP BY source
        ORDER BY sessions DESC
        LIMIT 15
      `),

      // --- Country breakdown -------------------------------------------
      runHogQL<CountryRow>(`
        WITH ${QUALIFYING_SESSIONS},
        session_country AS (
            SELECT $session_id AS session_id, argMin(properties.$geoip_country_name, timestamp) AS country
            FROM events
            WHERE event = '$pageview'
              AND timestamp >= now() - INTERVAL ${WINDOW_DAYS} DAY
            GROUP BY $session_id
        )
        SELECT sc.country AS country, count() AS sessions
        FROM session_country AS sc
        JOIN qualifying_sessions AS qs ON qs.session_id = sc.session_id
        GROUP BY country
        ORDER BY sessions DESC
        LIMIT 15
      `),

      // --- Top pages site-wide -------------------------------------------
      runHogQL<PageRow>(`
        WITH ${QUALIFYING_SESSIONS}
        SELECT
            e.properties.$pathname AS page,
            count() AS pageviews,
            uniq(e.$session_id) AS sessions,
            uniq(e.person_id) AS unique_visitors,
            round(avg(least(qs.duration, 1800)), 1) AS avg_session_duration_sec,
            topK(1)(qs.source) AS top_source,
            topK(1)(e.properties.$geoip_country_name) AS top_country
        FROM events AS e
        JOIN qualifying_sessions AS qs ON qs.session_id = e.$session_id
        WHERE e.event = '$pageview'
          AND e.timestamp >= now() - INTERVAL ${WINDOW_DAYS} DAY
        GROUP BY page
        ORDER BY pageviews DESC
        LIMIT 25
      `),

      // --- Top tradie directory listing pages -----------------------------
      runHogQL<PageRow>(`
        WITH ${QUALIFYING_SESSIONS}
        SELECT
            e.properties.$pathname AS page,
            count() AS pageviews,
            uniq(e.$session_id) AS sessions,
            uniq(e.person_id) AS unique_visitors,
            round(avg(least(qs.duration, 1800)), 1) AS avg_session_duration_sec,
            topK(1)(qs.source) AS top_source,
            topK(1)(e.properties.$geoip_country_name) AS top_country
        FROM events AS e
        JOIN qualifying_sessions AS qs ON qs.session_id = e.$session_id
        WHERE e.event = '$pageview'
          AND e.timestamp >= now() - INTERVAL ${WINDOW_DAYS} DAY
          AND e.properties.$pathname LIKE '/directory/%'
          AND e.properties.$pathname NOT IN ('/directory/claim', '/directory/manage')
        GROUP BY page
        ORDER BY pageviews DESC
        LIMIT 50
      `),
    ]);

    return NextResponse.json({
      windowDays: WINDOW_DAYS,
      minSessionSeconds: MIN_SESSION_SECONDS,
      overview: overview[0] ?? null,
      sources,
      countries,
      topPages,
      topTradiePages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load analytics data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
