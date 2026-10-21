/**
 * Free ABN directory pipeline for GitHub Actions (or a local shell).
 *
 *   npx tsx scripts/abn-directory-pipeline.ts --phase all
 *   npx tsx scripts/abn-directory-pipeline.ts --phase ingest
 *   npx tsx scripts/abn-directory-pipeline.ts --phase enrich
 *   npx tsx scripts/abn-directory-pipeline.ts --phase verify
 *
 * Phase ingest downloads each ABR zip once, stream-parses every XML
 * file inside it, and bulk-upserts trade matches into
 * abn_trade_candidates. Phase enrich guesses websites in parallel (no
 * paid search API). Phase verify checks ABN status and email MX records.
 *
 * Secrets (names only; do not commit values):
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ABN_LOOKUP_GUID          free GUID from https://abr.business.gov.au/Tools/WebServices
 *
 * Optional:
 *   ABN_ENRICH_LIMIT         candidates per run (default 800)
 *   DIRECTORY_VERIFY_LIMIT   listings per run (default 2000)
 *
 * GOOGLE_PLACES_API_KEY is removed from the environment before any work
 * so this job cannot call Places even if the secret is present on the runner.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadToFile, fetchDownloadUrls, ingestZipFile } from "@/lib/abnBulkIngest";
import { runAbnEnrichmentBatch } from "@/lib/abnDirectoryEnrichment";
import { runDirectoryVerification } from "@/lib/directoryVerification";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function requireEnv() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  delete process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
}

async function ingest() {
  const admin = createAdminClient();
  const urls = await fetchDownloadUrls();
  if (urls.length === 0) throw new Error("ABR resource list returned no zip URLs");

  const { data: cursorRow } = await admin.from("abn_ingest_cursor").select("*").eq("id", 1).maybeSingle();
  let split = cursorRow?.split_file_index ?? 1;
  let internal = cursorRow?.internal_file_index ?? 0;
  if (split > urls.length) {
    console.log("[abn] previous pass finished; starting again so this week's extract is picked up");
    split = 1;
    internal = 0;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "abn-bulk-"));
  try {
    for (let index = split - 1; index < urls.length; index++) {
      const url = urls[index];
      const dest = path.join(dir, `split-${index + 1}.zip`);
      console.log(`[abn] downloading split ${index + 1}/${urls.length} once: ${url}`);
      await downloadToFile(url, dest);
      const startEntry = index === split - 1 ? internal : 0;
      await ingestZipFile(dest, admin, {
        startEntryIndex: startEntry,
        onFile: async (entryIndex) => {
          await admin.from("abn_ingest_cursor").upsert({
            id: 1,
            split_file_index: index + 1,
            internal_file_index: entryIndex + 1,
            records_processed_in_file: 0,
            last_run_at: new Date().toISOString(),
          });
        },
      });
      await admin.from("abn_ingest_cursor").upsert({
        id: 1,
        split_file_index: index + 2,
        internal_file_index: 0,
        records_processed_in_file: 0,
        last_run_at: new Date().toISOString(),
      });
      internal = 0;
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function enrich() {
  const limit = Number(process.env.ABN_ENRICH_LIMIT ?? "800");
  let processed = 0;
  let created = 0;
  while (processed < limit) {
    const batch = await runAbnEnrichmentBatch({ batchSize: 40, concurrency: 6, maxBatches: 1 });
    processed += batch.processed;
    created += batch.listingsCreated;
    console.log(`[abn] enrich processed ${batch.processed}, created ${batch.listingsCreated}, remaining ${batch.remaining}`);
    if (batch.processed === 0) break;
  }
  console.log(`[abn] enrich done: processed ${processed}, listings created ${created}`);
}

async function verify() {
  const admin = createAdminClient();
  const limit = Number(process.env.DIRECTORY_VERIFY_LIMIT ?? "2000");
  if (!process.env.ABN_LOOKUP_GUID) {
    console.log("[verify] ABN_LOOKUP_GUID is not set. MX checks still run. ABN rows stay due until the GUID is set.");
  }
  const result = await runDirectoryVerification(admin, { limit });
  console.log("[verify]", result);
}

async function main() {
  requireEnv();
  const phase = arg("--phase") ?? "all";
  if (!["all", "ingest", "enrich", "verify"].includes(phase)) {
    console.error("--phase must be all, ingest, enrich, or verify");
    process.exit(1);
  }
  if (phase === "all" || phase === "ingest") await ingest();
  if (phase === "all" || phase === "enrich") await enrich();
  if (phase === "all" || phase === "verify") await verify();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
