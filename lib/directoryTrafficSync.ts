/**
 * lib/directoryTrafficSync.ts
 * -----------------------------
 * Pulls yesterday's pageview and click counts from PostHog for every
 * claimed directory listing, caches them in
 * directory_listing_traffic_daily. Matches on the stable 6-character
 * hex suffix at the end of every listing's slug (derived from the
 * listing's own UUID - see buildDirectorySlug in lib/seo/meta.ts)
 * rather than reconstructing the full business-name-based slug, since
 * the slug's name portion can change if a business edits their listed
 * name but the hex suffix never does.
 *
 * Runs once daily via cron - see app/api/cron/sync-directory-traffic.
 * "Yesterday" rather than "today" deliberately: syncing a day that's
 * fully complete avoids a partial-day count that would look like a
 * dip compared to later, more complete days when a tradie looks at
 * their trend.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { runHogQLQuery } from "@/lib/posthogQuery";

export interface TrafficSyncResult {
  listingsChecked: number;
  listingsSynced: number;
  listingsSkipped: number;
}

export async function syncYesterdaysTraffic(): Promise<TrafficSyncResult> {
  const admin = createAdminClient();
  const result: TrafficSyncResult = { listingsChecked: 0, listingsSynced: 0, listingsSkipped: 0 };

  const { data: claimedListings } = await admin
    .from("directory_listing")
    .select("id")
    .eq("is_claimed", true);

  if (!claimedListings || claimedListings.length === 0) return result;

  for (const listing of claimedListings) {
    result.listingsChecked++;
    const hexSuffix = listing.id.replace(/-/g, "").slice(-6);

    const pageviewQuery = `
      SELECT count()
      FROM events
      WHERE event = '$pageview'
        AND properties.$pathname LIKE '%-${hexSuffix}'
        AND toDate(timestamp) = yesterday()
    `;
    const clickQuery = `
      SELECT count()
      FROM events
      WHERE event = '$autocapture'
        AND properties.$pathname LIKE '%-${hexSuffix}'
        AND toDate(timestamp) = yesterday()
    `;

    const [pageviewResult, clickResult] = await Promise.all([
      runHogQLQuery(pageviewQuery),
      runHogQLQuery(clickQuery),
    ]);

    if (!pageviewResult || !clickResult) {
      console.error(`[directoryTrafficSync] query failed for listing ${listing.id} - skipping (see posthogQuery logs above for the actual error)`);
      result.listingsSkipped++;
      continue;
    }

    const pageviews = Number(pageviewResult.results[0]?.[0] ?? 0);
    const ctaClicks = Number(clickResult.results[0]?.[0] ?? 0);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const day = yesterday.toISOString().slice(0, 10);

    const { error } = await admin.from("directory_listing_traffic_daily").upsert({
      listing_id: listing.id,
      day,
      pageviews,
      cta_clicks: ctaClicks,
      synced_at: new Date().toISOString(),
    }, { onConflict: "listing_id,day" });

    if (error) {
      console.error(`[directoryTrafficSync] upsert failed for listing ${listing.id}:`, error.message);
      result.listingsSkipped++;
    } else {
      result.listingsSynced++;
    }
  }

  return result;
}
