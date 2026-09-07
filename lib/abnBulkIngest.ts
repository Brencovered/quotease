/**
 * lib/abnBulkIngest.ts
 * ----------------------
 * Phase 1 of getting more listings without Google, without individual
 * searches, and without paying for Yellow Pages access: the
 * Australian Business Register's Bulk Extract - free, open government
 * data (Creative Commons Attribution 3.0 AU), published weekly in
 * XML, specifically for bulk use like this. No scraping, no ToS risk,
 * no IP-blocking risk (unlike Yellow Pages, this is meant to be
 * downloaded wholesale).
 *
 * A real run revealed the actual file structure differs from what the
 * published documentation suggested: there are only 2 top-level zip
 * URLs (not ~20), because each one bundles multiple internal XML files
 * together - "public_split_1_10.zip" contains parts 1 through 10 as
 * separate files inside it, not one file named that. Each zip is large
 * enough that the download+unzip alone exceeded the original 60s
 * function limit before a single record was parsed - confirmed via
 * Vercel logs, not assumed.
 *
 * Resumable across two axes now: abn_ingest_cursor tracks which
 * top-level zip (split_file_index) AND which internal file within it
 * (internal_file_index) the last run reached. A real, accepted
 * inefficiency worth being upfront about: each call that needs to
 * continue partway through a zip's internal files re-downloads the
 * whole zip (there's no persistent memory between separate serverless
 * invocations to cache it in), so a large zip does get fetched
 * multiple times across the calls needed to work through all its
 * internal files. That's real wasted bandwidth, not free - accepted
 * for now rather than adding a "cache the extracted files somewhere
 * persistent" layer, since this only needs to run occasionally, not
 * continuously.
 *
 * Each call processes exactly one internal XML file, not a time-
 * budgeted "as many as fit" loop - see the memory note further down
 * for why.
 *
 * XML schema below is the standard public ABR bulk extract format
 * (stable, long-documented) - not independently verified against a
 * freshly downloaded real file the way the Yellow Pages HTML
 * structure eventually was, since this environment can't reach
 * data.gov.au directly to fetch a sample first. Logs liberally by
 * design (the lesson from today's Yellow Pages debugging) so if the
 * real schema differs in some way, that shows up clearly in Vercel
 * runtime logs on the first real run rather than silently matching
 * nothing.
 */

import JSZip from "jszip";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRADE_NAME_KEYWORDS } from "@/lib/tradeNameKeywords";

// The government's own resource-list CSV enumerates every split file
// and its download URL - fetched fresh each run rather than
// hardcoding URLs, since the government occasionally reshuffles file
// names/counts between extract refreshes.
const RESOURCE_LIST_URL = "https://data.gov.au/data/dataset/5bd7fcab-e315-42cb-8daf-50b7efc2027e/resource/469c8c2c-0be5-45b2-90d7-c42f637f3323/download/abn-bulk-extract-resources.csv";

// Leaves buffer under the route's 300s maxDuration for the download
// itself (which turned out to be the slow part - a real ~500MB zip).



interface ParsedAbnRecord {
  abn: string;
  legalName: string;
  tradingName: string | null;
  state: string | null;
  postcode: string | null;
  entityType: string | null;
}

async function fetchDownloadUrls(): Promise<string[]> {
  try {
    const res = await fetch(RESOURCE_LIST_URL);
    if (!res.ok) {
      console.error(`[abnBulkIngest] resource list fetch failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const csv = await res.text();
    // Simple CSV: Name, type, download link - link column contains the .zip URL
    const urls = [...csv.matchAll(/https?:\/\/[^\s,"]+\.zip/gi)].map(m => m[0]);
    return [...new Set(urls)];
  } catch (err) {
    console.error("[abnBulkIngest] resource list fetch threw:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Extracts <ABR>...</ABR> records from the raw XML text and pulls out
 * the fields this needs. Regex-based rather than a full XML parser -
 * consistent with how the rest of this codebase parses HTML, and
 * avoids adding a heavier dependency for what's a fairly flat schema.
 */
function parseAbrRecords(xml: string): ParsedAbnRecord[] {
  const records: ParsedAbnRecord[] = [];
  const blocks = xml.matchAll(/<ABR[^>]*>([\s\S]*?)<\/ABR>/g);

  for (const block of blocks) {
    const content = block[1];

    const abnMatch = content.match(/<ABN[^>]*>(\d{11})<\/ABN>/);
    if (!abnMatch) continue;

    // MainEntity holds the legal name; OtherEntity (type="TRD") holds
    // any registered trading name, when one exists.
    const mainEntityMatch = content.match(/<MainEntity>([\s\S]*?)<\/MainEntity>/);
    const legalNameMatch = mainEntityMatch?.[1]?.match(/<NonIndividualNameText>([^<]+)<\/NonIndividualNameText>/)
      ?? content.match(/<NonIndividualNameText>([^<]+)<\/NonIndividualNameText>/);
    if (!legalNameMatch) continue;

    const tradingNameMatch = content.match(/<NonIndividualName type=["']TRD["']>[\s\S]*?<NonIndividualNameText>([^<]+)<\/NonIndividualNameText>/);
    const stateMatch = content.match(/<State>([A-Z]{2,3})<\/State>/);
    const postcodeMatch = content.match(/<Postcode>(\d{4})<\/Postcode>/);
    const entityTypeMatch = content.match(/<EntityTypeText>([^<]+)<\/EntityTypeText>/);

    records.push({
      abn: abnMatch[1],
      legalName: legalNameMatch[1].trim(),
      tradingName: tradingNameMatch ? tradingNameMatch[1].trim() : null,
      state: stateMatch ? stateMatch[1] : null,
      postcode: postcodeMatch ? postcodeMatch[1] : null,
      entityType: entityTypeMatch ? entityTypeMatch[1].trim() : null,
    });
  }

  return records;
}

function matchTrade(record: ParsedAbnRecord): string | null {
  const haystack = `${record.legalName} ${record.tradingName ?? ""}`.toLowerCase();
  for (const [trade, keywords] of Object.entries(TRADE_NAME_KEYWORDS)) {
    if (keywords.some(kw => haystack.includes(kw))) return trade;
  }
  return null;
}

export interface AbnIngestResult {
  splitFileIndex: number;
  recordsScanned: number;
  tradeMatches: number;
  candidatesInserted: number;
  finishedAllFiles: boolean;
  error?: string;
}

export async function ingestNextChunk(): Promise<AbnIngestResult> {
  const admin = createAdminClient();

  const { data: cursorRow } = await admin.from("abn_ingest_cursor").select("*").eq("id", 1).single();
  const cursor = cursorRow ?? { split_file_index: 1, records_processed_in_file: 0, internal_file_index: 0 };

  const urls = await fetchDownloadUrls();
  if (urls.length === 0) {
    return { splitFileIndex: cursor.split_file_index, recordsScanned: 0, tradeMatches: 0, candidatesInserted: 0, finishedAllFiles: false, error: "Could not fetch the ABR resource list - see logs" };
  }

  if (cursor.split_file_index > urls.length) {
    console.error(`[abnBulkIngest] cursor past end of file list (${cursor.split_file_index} > ${urls.length}) - all files already ingested`);
    return { splitFileIndex: cursor.split_file_index, recordsScanned: 0, tradeMatches: 0, candidatesInserted: 0, finishedAllFiles: true };
  }

  const fileUrl = urls[cursor.split_file_index - 1];
  console.log(`[abnBulkIngest] processing split file ${cursor.split_file_index}/${urls.length}: ${fileUrl}, resuming at internal file ${cursor.internal_file_index}`);

  let xmlFiles: JSZip.JSZipObject[];
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) {
      console.error(`[abnBulkIngest] split file fetch failed: ${res.status} ${res.statusText} for ${fileUrl}`);
      return { splitFileIndex: cursor.split_file_index, recordsScanned: 0, tradeMatches: 0, candidatesInserted: 0, finishedAllFiles: false, error: `fetch failed: ${res.status}` };
    }
    const zipBuffer = await res.arrayBuffer();
    console.log(`[abnBulkIngest] downloaded ${(zipBuffer.byteLength / 1_000_000).toFixed(1)}MB, unzipping...`);
    const zip = await JSZip.loadAsync(zipBuffer);
    xmlFiles = Object.values(zip.files).filter(f => f.name.toLowerCase().endsWith(".xml") && !f.dir);
    if (xmlFiles.length === 0) {
      console.error(`[abnBulkIngest] no XML files found inside zip ${fileUrl} - entries: ${Object.keys(zip.files).join(", ")}`);
      return { splitFileIndex: cursor.split_file_index, recordsScanned: 0, tradeMatches: 0, candidatesInserted: 0, finishedAllFiles: false, error: "no XML in zip - see logs" };
    }
    console.log(`[abnBulkIngest] zip contains ${xmlFiles.length} internal XML file(s), resuming at index ${cursor.internal_file_index}`);
  } catch (err) {
    console.error(`[abnBulkIngest] download/unzip threw for ${fileUrl}:`, err instanceof Error ? err.message : err);
    return { splitFileIndex: cursor.split_file_index, recordsScanned: 0, tradeMatches: 0, candidatesInserted: 0, finishedAllFiles: false, error: err instanceof Error ? err.message : "unzip failed" };
  }

  // Processes exactly ONE internal file per call now, not "as many as
  // fit in the time budget" - a real production run OOM'd (Vercel:
  // "instance was killed because it ran out of available memory")
  // after the 497MB zip downloaded and unzipped successfully, while
  // working through its internal files. The raw zip buffer alone
  // (JSZip needs it held in memory for the whole duration to lazily
  // decompress any file on demand) plus one decompressed XML file's
  // text was apparently already enough to hit the ceiling - looping
  // through multiple files in the same call, as the previous version
  // did, only made that worse. This does mean re-downloading the same
  // 497MB zip on every subsequent call needed to work through its
  // other internal files - a second, real cost on top of the
  // resume-partway-through-a-zip cost already documented above, both
  // accepted for the same reason: this runs occasionally, not
  // continuously, and getting real progress without crashing matters
  // more than minimizing bandwidth here.
  const xmlFile = xmlFiles[cursor.internal_file_index];
  const xml = await xmlFile.async("text");
  const records = parseAbrRecords(xml);
  if (records.length === 0) {
    console.error(`[abnBulkIngest] parsed 0 records from internal file "${xmlFile.name}" (${xml.length} chars) - schema may not match what this parser expects, see parseAbrRecords()`);
  } else {
    console.log(`[abnBulkIngest] internal file "${xmlFile.name}": ${records.length} records`);
  }

  let totalScanned = 0;
  let totalTradeMatches = 0;
  let totalInserted = 0;

  for (const record of records) {
    totalScanned++;
    const trade = matchTrade(record);
    if (!trade) continue;
    totalTradeMatches++;

    const { error } = await admin.from("abn_trade_candidates").insert({
      abn: record.abn,
      legal_name: record.legalName,
      trading_name: record.tradingName,
      matched_trade: trade,
      state: record.state,
      postcode: record.postcode,
      entity_type: record.entityType,
    });
    // Unique constraint on abn means a re-run naturally skips dupes -
    // any other error is worth knowing about, a duplicate-key error is not.
    if (!error) totalInserted++;
    else if (!error.message.includes("duplicate key")) {
      console.error(`[abnBulkIngest] insert failed for ABN ${record.abn}:`, error.message);
    }
  }

  const finishedThisZip = cursor.internal_file_index + 1 >= xmlFiles.length;
  const nextFileIndex = finishedThisZip ? cursor.split_file_index + 1 : cursor.split_file_index;
  const nextInternalFileIndex = finishedThisZip ? 0 : cursor.internal_file_index + 1;

  await admin.from("abn_ingest_cursor").upsert({
    id: 1,
    split_file_index: nextFileIndex,
    internal_file_index: nextInternalFileIndex,
    records_processed_in_file: 0,
    last_run_at: new Date().toISOString(),
  });

  return {
    splitFileIndex: cursor.split_file_index,
    recordsScanned: totalScanned,
    tradeMatches: totalTradeMatches,
    candidatesInserted: totalInserted,
    finishedAllFiles: finishedThisZip && nextFileIndex > urls.length,
  };
}
