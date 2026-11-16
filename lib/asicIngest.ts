/**
 * Stream the current ASIC company zip and queue recent trade companies.
 * Runs from GitHub Actions (scripts/abn-directory-pipeline.ts). No paid API.
 */

import { createInterface } from "node:readline";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { downloadToFile, listZipEntries, openZipEntry } from "@/lib/abnBulkIngest";
import {
  ASIC_PACKAGE_URL,
  asicLookbackDays,
  headerIndex,
  parseAsicRow,
  pickAsicZipUrl,
  planAsicQueue,
  registrationCutoff,
  toCandidate,
  type AsicCandidateDraft,
  type AsicResource,
  type ExistingCandidate,
} from "@/lib/asicCompany";

const FLUSH_EVERY = 100;

export interface AsicIngestResult {
  zipUrl: string;
  lookbackDays: number;
  scanned: number;
  matched: number;
  inserted: number;
  refreshed: number;
}

export async function fetchAsicZipUrl(fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(ASIC_PACKAGE_URL, { headers: { "User-Agent": "swiftscope-asic-directory" } });
  if (!response.ok) {
    throw new Error(`ASIC CKAN package request failed: ${response.status} ${response.statusText}`);
  }
  const body = await response.json() as { result?: { resources?: AsicResource[] } };
  return pickAsicZipUrl(body.result?.resources ?? []);
}

export async function ingestAsicCompanies(
  admin: SupabaseClient,
  options?: { onProgress?: (message: string, inserted: number) => Promise<void> },
): Promise<AsicIngestResult> {
  const { count, error: countError } = await admin
    .from("abn_trade_candidates")
    .select("id", { count: "exact", head: true })
    .eq("source", "asic_company");
  if (countError) {
    throw new Error(`ASIC candidate columns are not ready (${countError.message}). Apply supabase/migrations/20261116015756_asic_company_candidates.sql.`);
  }

  const lookbackDays = asicLookbackDays(process.env, (count ?? 0) > 0);
  const cutoff = registrationCutoff(new Date(), lookbackDays);
  const zipUrl = await fetchAsicZipUrl();
  await options?.onProgress?.(`Downloading ASIC companies registered since ${cutoff}.`, 0);

  const dir = await mkdtemp(path.join(tmpdir(), "asic-company-"));
  const dest = path.join(dir, "companies.zip");
  const totals = { scanned: 0, matched: 0, inserted: 0, refreshed: 0 };
  try {
    await downloadToFile(zipUrl, dest);
    const entries = await listZipEntries(dest);
    const csvName = entries.find((name) => name.toLowerCase().endsWith(".csv") || name.toLowerCase().endsWith(".txt"));
    if (!csvName) throw new Error(`ASIC zip has no CSV entry. Entries: ${entries.slice(0, 5).join(", ")}`);

    let columns: Map<string, number> | null = null;
    let pending: AsicCandidateDraft[] = [];

    async function flush() {
      if (pending.length === 0) return;
      const batch = pending;
      pending = [];
      const wrote = await writeBatch(admin, batch);
      totals.inserted += wrote.inserted;
      totals.refreshed += wrote.refreshed;
      await options?.onProgress?.(
        `ASIC: scanned ${totals.scanned}, matched ${totals.matched}, queued ${totals.inserted}, updated ${totals.refreshed}.`,
        totals.inserted,
      );
    }

    const lines = createInterface({ input: openZipEntry(dest, csvName), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!columns) {
        columns = headerIndex(line);
        if (!columns.has("company name") || !columns.has("acn") || !columns.has("date of registration")) {
          throw new Error("ASIC file header is missing Company Name, ACN, or Date of Registration.");
        }
        continue;
      }
      totals.scanned += 1;
      const company = parseAsicRow(line, columns);
      if (!company) continue;
      const draft = toCandidate(company, cutoff);
      if (!draft) continue;
      totals.matched += 1;
      pending.push(draft);
      if (pending.length >= FLUSH_EVERY) await flush();
    }
    await flush();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  return { zipUrl, lookbackDays, ...totals };
}

async function writeBatch(
  admin: SupabaseClient,
  drafts: AsicCandidateDraft[],
): Promise<{ inserted: number; refreshed: number }> {
  const abns = [...new Set(drafts.map((draft) => draft.abn).filter((abn): abn is string => !!abn))];
  const acns = [...new Set(drafts.map((draft) => draft.acn))];
  const existing: ExistingCandidate[] = [];

  if (abns.length > 0) {
    const { data, error } = await admin.from("abn_trade_candidates").select("abn, acn, processed_at").in("abn", abns);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) existing.push(asExisting(row));
  }
  if (acns.length > 0) {
    const { data, error } = await admin.from("abn_trade_candidates").select("abn, acn, processed_at").in("acn", acns);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) existing.push(asExisting(row));
  }

  const listingAbns = new Set<string>();
  if (abns.length > 0) {
    const { data, error } = await admin.from("directory_listing").select("abn").in("abn", abns);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (row.abn) listingAbns.add(row.abn);
    }
  }

  const plan = planAsicQueue(drafts, existing, listingAbns);
  let inserted = 0;
  if (plan.insert.length > 0) {
    const { data, error } = await admin.from("abn_trade_candidates").insert(plan.insert).select("id");
    if (error) throw new Error(error.message);
    inserted = data?.length ?? plan.insert.length;
  }

  for (const draft of plan.refreshAbns) {
    const patch = {
      source: "asic_company" as const,
      acn: draft.acn,
      registered_at: draft.registered_at,
      state: draft.state,
      entity_type: draft.entity_type,
      abn: draft.abn,
    };
    const byAcn = await admin.from("abn_trade_candidates").update(patch).eq("acn", draft.acn).is("processed_at", null);
    if (byAcn.error) throw new Error(byAcn.error.message);
    if (draft.abn) {
      const byAbn = await admin.from("abn_trade_candidates").update(patch).eq("abn", draft.abn).is("processed_at", null);
      if (byAbn.error) throw new Error(byAbn.error.message);
    }
  }

  return { inserted, refreshed: plan.refreshAbns.length };
}

function asExisting(row: { abn: string | null; acn: string | null; processed_at: string | null }): ExistingCandidate {
  return { abn: row.abn, acn: row.acn, processed: row.processed_at != null };
}
