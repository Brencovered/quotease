/**
 * lib/directoryExpansionSweep.ts
 * --------------------------------
 * Automates the Yellow Pages scraper across the full trade x location
 * matrix (lib/tradeLocationMatrix.ts) instead of requiring someone to
 * pick a combo and click "scrape" one at a time in the admin UI.
 *
 * Each run picks the next N combos - never-scraped ones first, then
 * whichever were scraped longest ago - scrapes each via the same
 * shared logic the manual admin tool uses (lib/yellowPagesScraper.ts),
 * and records coverage in directory_scrape_coverage so the next run
 * picks up where this one left off rather than re-hitting the same
 * combos. Never re-does a combo within REFRESH_DAYS, so a sweep that's
 * already covered the whole matrix naturally settles into just
 * refreshing the oldest coverage rather than hammering everything
 * constantly.
 *
 * Batch size (6 combos, 2 pages each) is sized to comfortably fit
 * inside the cron route's 60s execution limit (see maxDuration in
 * app/api/cron/expand-directory/route.ts) - better to run a small
 * batch reliably many times than risk a single run timing out partway
 * through and losing that work. At 360 total combos (15 trades x 24
 * locations) and one run/day, that's a full first sweep in about 60
 * days on the cron alone - the admin UI also exposes a manual "run
 * next batch now" trigger for whenever faster coverage is wanted
 * without waiting on the schedule.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeYellowPagesCombo } from "@/lib/yellowPagesScraper";
import { TRADES, LOCATIONS } from "@/lib/tradeLocationMatrix";

const BATCH_SIZE = 6;
const PAGES_PER_COMBO = 2;
const REFRESH_DAYS = 30; // don't re-scrape a combo covered more recently than this

export interface SweepResult {
  combosProcessed: number;
  totalFound: number;
  totalInserted: number;
  totalSkipped: number;
  combos: { trade: string; location: string; found: number; inserted: number }[];
  remainingNeverScraped: number;
  matrixSize: number;
}

export async function runDirectoryExpansionSweep(): Promise<SweepResult> {
  const admin = createAdminClient();

  // The full matrix is TRADES x LOCATIONS, computed here rather than
  // stored, so adding a trade or location to the shared list
  // automatically expands what the sweep covers next time.
  const allCombos = TRADES.flatMap(trade =>
    LOCATIONS.map(loc => ({ trade, location: loc }))
  );

  const { data: coverageRows } = await admin
    .from("directory_scrape_coverage")
    .select("trade, location_label, last_scraped_at");

  const coverageMap = new Map<string, string | null>();
  for (const row of coverageRows ?? []) {
    coverageMap.set(`${row.trade}::${row.location_label}`, row.last_scraped_at);
  }

  const refreshCutoff = Date.now() - REFRESH_DAYS * 24 * 60 * 60 * 1000;

  // Never-scraped combos first (null coverage), then oldest last_scraped_at
  // among combos due for a refresh - a combo scraped inside REFRESH_DAYS
  // is left alone entirely, not just deprioritised, so a fresh combo
  // never gets re-hit before it's actually due again.
  const candidates = allCombos
    .map(c => {
      const key = `${c.trade}::${c.location.label}`;
      const lastScraped = coverageMap.get(key) ?? null;
      return { ...c, lastScraped, lastScrapedTime: lastScraped ? new Date(lastScraped).getTime() : null };
    })
    .filter(c => c.lastScrapedTime === null || c.lastScrapedTime < refreshCutoff)
    .sort((a, b) => {
      // nulls (never scraped) first
      if (a.lastScrapedTime === null && b.lastScrapedTime !== null) return -1;
      if (a.lastScrapedTime !== null && b.lastScrapedTime === null) return 1;
      if (a.lastScrapedTime === null && b.lastScrapedTime === null) return 0;
      return a.lastScrapedTime! - b.lastScrapedTime!;
    });

  const remainingNeverScraped = candidates.filter(c => c.lastScrapedTime === null).length;
  const batch = candidates.slice(0, BATCH_SIZE);

  const result: SweepResult = {
    combosProcessed: 0,
    totalFound: 0,
    totalInserted: 0,
    totalSkipped: 0,
    combos: [],
    remainingNeverScraped,
    matrixSize: allCombos.length,
  };

  for (const combo of batch) {
    const scraped = await scrapeYellowPagesCombo(
      combo.trade,
      combo.location.suburb,
      combo.location.postcode,
      PAGES_PER_COMBO,
      admin
    );

    await admin.from("directory_scrape_coverage").upsert({
      trade: combo.trade,
      location_label: combo.location.label,
      suburb: combo.location.suburb,
      postcode: combo.location.postcode,
      last_scraped_at: new Date().toISOString(),
      last_found: scraped.found,
      last_inserted: scraped.inserted,
    }, { onConflict: "trade,location_label" });

    result.combosProcessed++;
    result.totalFound += scraped.found;
    result.totalInserted += scraped.inserted;
    result.totalSkipped += scraped.skipped;
    result.combos.push({
      trade: combo.trade,
      location: combo.location.label,
      found: scraped.found,
      inserted: scraped.inserted,
    });
  }

  return result;
}
