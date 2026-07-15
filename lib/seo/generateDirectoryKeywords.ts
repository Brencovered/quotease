/**
 * lib/seo/generateDirectoryKeywords.ts
 * -------------------------------------
 * Keeps seo_keywords in sync with the directory's actual trade+suburb
 * coverage, nationally, as it grows. This is deliberately NOT a one-off
 * batch: it re-derives the full list from live directory_listing data
 * every time it runs, using the exact same MIN_LISTINGS_FOR_INDEX
 * threshold and tradeToSlug()/suburbToSlug() functions the real sitemap
 * and SEO landing pages use - so a tracked keyword always corresponds to
 * a page that actually exists and is indexable, in any state, for any
 * trade, as new suburbs and trades get added.
 *
 * Safe to re-run any time: inserts are keyed against the unique
 * lower(trim(keyword)) index on seo_keywords, so an existing keyword
 * (including ones a person has already triaged into Targeting/Tracking/
 * Ignore) is never touched or duplicated. This only ever adds new rows.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { tradeToSlug } from "@/lib/seo/meta";

// Matches the threshold in app/sitemap.ts - a trade+suburb combo only
// gets its own indexable page once it clears this many real listings.
const MIN_LISTINGS_FOR_INDEX = 3;

export interface GenerateResult {
  combosFound: number;
  keywordsInserted: number;
  totalTracked: number;
}

export async function generateDirectoryKeywords(): Promise<GenerateResult> {
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("directory_listing")
    .select("trades, suburb")
    .not("suburb", "is", null);

  if (error) {
    throw new Error(`[generateDirectoryKeywords] Failed to load directory_listing: ${error.message}`);
  }

  // Same aggregation the sitemap's fallback path uses: unnest trades per
  // listing, count per (trade, suburb) pair, nationally - no state/region
  // filtering, so this scales automatically as new cities get listings.
  const counts = new Map<string, { trade: string; suburb: string; count: number }>();
  for (const row of rows ?? []) {
    for (const trade of row.trades ?? []) {
      const key = `${trade}|${row.suburb}`;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { trade, suburb: row.suburb, count: 1 });
    }
  }

  const combos = Array.from(counts.values()).filter((c) => c.count >= MIN_LISTINGS_FOR_INDEX);

  const payload = combos.map((c) => {
    // tradeToSlug gives the real page's slug fragment (e.g. "air-conditioning",
    // "electricians") - convert hyphens to spaces for a natural keyword phrase
    // while staying identical in wording to what the page is actually titled for.
    const tradePhrase = tradeToSlug(c.trade).replace(/-/g, " ");
    const keyword = `${tradePhrase} ${c.suburb.toLowerCase()}`.trim();
    return {
      keyword,
      intent: "Local",
      status: "new" as const,
      notes: `Directory page - ${c.count} listing${c.count === 1 ? "" : "s"}`,
    };
  });

  let keywordsInserted = 0;
  if (payload.length > 0) {
    // upsert with ignoreDuplicates: existing keywords (including ones already
    // triaged by a person) are left completely untouched; only genuinely new
    // trade+suburb combos get inserted.
    const { data: inserted, error: insertError } = await admin
      .from("seo_keywords")
      .upsert(payload, { onConflict: "keyword", ignoreDuplicates: true })
      .select("id");

    if (insertError) {
      throw new Error(`[generateDirectoryKeywords] Insert failed: ${insertError.message}`);
    }
    keywordsInserted = inserted?.length ?? 0;
  }

  const { count: totalTracked } = await admin
    .from("seo_keywords")
    .select("id", { count: "exact", head: true });

  return {
    combosFound: combos.length,
    keywordsInserted,
    totalTracked: totalTracked ?? 0,
  };
}
