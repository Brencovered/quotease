/**
 * lib/seo/syncKeywordRankings.ts
 * -------------------------------
 * Pulls real Google Search Console position/click/impression data for the
 * last 28 days and writes it onto matching rows in seo_keywords, so the
 * "Ranking" status in /admin/seo reflects reality instead of being a bucket
 * nobody has a way to populate.
 *
 * Matching is by exact (case-insensitive) query string. GSC's Search
 * Analytics API only returns queries Swiftscope has actually received
 * impressions for, so most of the 120 imported keywords will simply not
 * appear in the response until real ranking exists for them, that's
 * expected, not a bug.
 *
 * Requires the same three manual setup steps documented in
 * lib/seo/searchConsole.ts (Google Cloud service account + GSC property
 * access + GOOGLE_SERVICE_ACCOUNT_KEY env var). Until those exist, this
 * throws the same clear scaffold error rather than silently doing nothing.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getSearchAnalytics } from "@/lib/seo/searchConsole";

export interface SyncResult {
  matched: number;
  updated: number;
  totalGscRows: number;
  syncedAt: string;
}

export async function syncKeywordRankings(): Promise<SyncResult> {
  const admin = createAdminClient();

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 28);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const rows = await getSearchAnalytics({
    startDate: fmt(start),
    endDate: fmt(end),
    dimensions: ["query"],
    rowLimit: 5000,
  });

  // GSC query -> stats, lowercased for case-insensitive matching
  const gscByQuery = new Map<string, { position: number; clicks: number; impressions: number }>();
  for (const row of rows) {
    const query = row.keys[0]?.toLowerCase().trim();
    if (!query) continue;
    gscByQuery.set(query, {
      position: row.position,
      clicks: row.clicks,
      impressions: row.impressions,
    });
  }

  const { data: keywords, error: fetchError } = await admin
    .from("seo_keywords")
    .select("id, keyword, status");

  if (fetchError) {
    throw new Error(`[syncKeywordRankings] Failed to load seo_keywords: ${fetchError.message}`);
  }

  const syncedAt = new Date().toISOString();
  let updated = 0;

  for (const kw of keywords ?? []) {
    const match = gscByQuery.get(kw.keyword.toLowerCase().trim());

    if (!match) {
      // No GSC data for this term in the window. Leave existing position data
      // and status alone -- absence of data isn't evidence the keyword
      // dropped out of the index, it may just be outside the 28-day window.
      continue;
    }

    const payload: Record<string, unknown> = {
      current_position: Math.round(match.position * 10) / 10,
      clicks_28d: match.clicks,
      impressions_28d: match.impressions,
      last_synced_at: syncedAt,
      updated_at: syncedAt,
    };

    // Only auto-promote status to "ranking" if the keyword hasn't been
    // deliberately set to "ignore" -- never override a manual decision.
    if (kw.status !== "ignore" && kw.status !== "ranking") {
      payload.status = "ranking";
    }

    const { error: updateError } = await admin
      .from("seo_keywords")
      .update(payload)
      .eq("id", kw.id);

    if (!updateError) updated += 1;
  }

  return {
    matched: gscByQuery.size,
    updated,
    totalGscRows: rows.length,
    syncedAt,
  };
}
