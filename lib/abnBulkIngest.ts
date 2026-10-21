/**
 * lib/abnBulkIngest.ts
 * ----------------------
 * Phase 1 of the free ABN directory pipeline. The ABR bulk extract is
 * public government data. Each zip is hundreds of megabytes and holds
 * several XML files.
 *
 * The supported runner is scripts/abn-directory-pipeline.ts via GitHub
 * Actions: download each zip once onto disk, stream-parse it with unzip,
 * and bulk-upsert trade matches. Do not run this inside a Vercel
 * function. A previous version re-downloaded the zip on every call and
 * was killed by the function timeout before it inserted anything, which
 * is why abn_trade_candidates stayed empty.
 */

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Readable as NodeReadable } from "node:stream";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRADE_NAME_KEYWORDS } from "@/lib/tradeNameKeywords";
import {
  isActiveAbnRecord,
  parseAbrBlock,
  takeCompleteAbrBlocks,
  type ParsedAbnRecord,
} from "@/lib/abnRecord";

export type { ParsedAbnRecord };
export { parseAbrRecords } from "@/lib/abnRecord";

const RESOURCE_LIST_URL = "https://data.gov.au/data/dataset/5bd7fcab-e315-42cb-8daf-50b7efc2027e/resource/469c8c2c-0be5-45b2-90d7-c42f637f3323/download/abn-bulk-extract-resources.csv";

const INSERT_BATCH = 500;

export async function fetchDownloadUrls(): Promise<string[]> {
  const res = await fetch(RESOURCE_LIST_URL);
  if (!res.ok) {
    throw new Error(`ABR resource list fetch failed: ${res.status} ${res.statusText}`);
  }
  const csv = await res.text();
  const urls = [...csv.matchAll(/https?:\/\/[^\s,"]+\.zip/gi)].map((match) => match[0]);
  return [...new Set(urls)];
}

export function matchTrade(record: Pick<ParsedAbnRecord, "legalName" | "tradingName">): string | null {
  const haystack = `${record.legalName} ${record.tradingName ?? ""}`.toLowerCase();
  for (const [trade, keywords] of Object.entries(TRADE_NAME_KEYWORDS)) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return trade;
  }
  return null;
}

export async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`download failed: ${res.status} ${res.statusText} for ${url}`);
  }
  await pipeline(
    Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream),
    createWriteStream(dest),
  );
}

function execFile(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString("utf8").slice(0, 500)}`));
        return;
      }
      resolve(Buffer.concat(stdout).toString("utf8"));
    });
  });
}

export async function listZipXmlEntries(zipPath: string): Promise<string[]> {
  const listing = await execFile("unzip", ["-Z1", zipPath]);
  return listing
    .split("\n")
    .map((line) => line.trim())
    .filter((name) => name.toLowerCase().endsWith(".xml") && !name.endsWith("/"));
}

export function openZipEntry(zipPath: string, entry: string): NodeReadable {
  const child = spawn("unzip", ["-p", zipPath, entry], { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });
  child.on("close", (code) => {
    if (code !== 0) {
      child.stdout.destroy(new Error(`unzip -p ${entry} exited ${code}: ${stderr.slice(0, 300)}`));
    }
  });
  return child.stdout;
}

export async function forEachAbrRecord(
  stream: NodeReadable,
  onBatch: (records: ParsedAbnRecord[]) => Promise<void>,
  batchSize = 2000,
): Promise<number> {
  let buffer = "";
  let pending: ParsedAbnRecord[] = [];
  let count = 0;

  async function flush() {
    if (pending.length === 0) return;
    const batch = pending;
    pending = [];
    await onBatch(batch);
  }

  function pushBlock(block: string) {
    const record = parseAbrBlock(block);
    if (!record) return;
    count += 1;
    pending.push(record);
  }

  for await (const chunk of stream) {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    const taken = takeCompleteAbrBlocks(buffer);
    buffer = taken.rest;
    for (const block of taken.blocks) pushBlock(block);
    if (pending.length >= batchSize) await flush();
  }

  const tail = takeCompleteAbrBlocks(buffer);
  for (const block of tail.blocks) pushBlock(block);
  await flush();
  return count;
}

export interface CandidateInsertResult {
  scanned: number;
  inactiveSkipped: number;
  tradeMatches: number;
  candidatesInserted: number;
}

function dedupeByAbn(rows: { abn: string }[]): typeof rows {
  const seen = new Set<string>();
  const out: typeof rows = [];
  for (const row of rows) {
    if (seen.has(row.abn)) continue;
    seen.add(row.abn);
    out.push(row);
  }
  return out;
}

export async function insertTradeCandidates(
  admin: ReturnType<typeof createAdminClient>,
  records: ParsedAbnRecord[],
): Promise<CandidateInsertResult> {
  const result: CandidateInsertResult = {
    scanned: records.length,
    inactiveSkipped: 0,
    tradeMatches: 0,
    candidatesInserted: 0,
  };
  const rows: {
    abn: string;
    legal_name: string;
    trading_name: string | null;
    matched_trade: string;
    state: string | null;
    postcode: string | null;
    entity_type: string | null;
  }[] = [];

  for (const record of records) {
    if (!isActiveAbnRecord(record)) {
      result.inactiveSkipped += 1;
      continue;
    }
    const trade = matchTrade(record);
    if (!trade) continue;
    result.tradeMatches += 1;
    rows.push({
      abn: record.abn,
      legal_name: record.legalName,
      trading_name: record.tradingName,
      matched_trade: trade,
      state: record.state,
      postcode: record.postcode,
      entity_type: record.entityType,
    });
  }

  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = dedupeByAbn(rows.slice(i, i + INSERT_BATCH));
    const { data, error } = await admin
      .from("abn_trade_candidates")
      .upsert(batch, { onConflict: "abn", ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.error("[abnBulkIngest] bulk insert failed:", error.message);
      continue;
    }
    result.candidatesInserted += data?.length ?? 0;
  }

  return result;
}

/**
 * Stream one zip that is already on disk. Calls onFile after each XML
 * entry so the caller can advance a resume cursor without re-downloading.
 */
export async function ingestZipFile(
  zipPath: string,
  admin: ReturnType<typeof createAdminClient>,
  options?: { startEntryIndex?: number; onFile?: (entryIndex: number, entryName: string, result: CandidateInsertResult) => Promise<void> },
): Promise<{ files: number; scanned: number; tradeMatches: number; candidatesInserted: number }> {
  const entries = await listZipXmlEntries(zipPath);
  const start = options?.startEntryIndex ?? 0;
  const totals = { files: 0, scanned: 0, tradeMatches: 0, candidatesInserted: 0 };

  for (let index = start; index < entries.length; index++) {
    const entry = entries[index];
    let fileResult: CandidateInsertResult = { scanned: 0, inactiveSkipped: 0, tradeMatches: 0, candidatesInserted: 0 };
    const scanned = await forEachAbrRecord(openZipEntry(zipPath, entry), async (records) => {
      const inserted = await insertTradeCandidates(admin, records);
      fileResult = {
        scanned: fileResult.scanned + inserted.scanned,
        inactiveSkipped: fileResult.inactiveSkipped + inserted.inactiveSkipped,
        tradeMatches: fileResult.tradeMatches + inserted.tradeMatches,
        candidatesInserted: fileResult.candidatesInserted + inserted.candidatesInserted,
      };
    });
    if (fileResult.scanned === 0) fileResult.scanned = scanned;
    totals.files += 1;
    totals.scanned += fileResult.scanned;
    totals.tradeMatches += fileResult.tradeMatches;
    totals.candidatesInserted += fileResult.candidatesInserted;
    console.log(`[abnBulkIngest] ${entry}: scanned ${fileResult.scanned}, matched ${fileResult.tradeMatches}, inserted ${fileResult.candidatesInserted}`);
    await options?.onFile?.(index, entry, fileResult);
  }

  return totals;
}
