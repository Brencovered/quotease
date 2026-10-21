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
 *   ABN_DIRECTORY_RUN_ID     abn_directory_runs id, set by the admin page
 *   GITHUB_RUN_URL           link stored on that row for the admin panel
 *
 * GOOGLE_PLACES_API_KEY is removed from the environment before any work
 * so this job cannot call Places even if the secret is present on the runner.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadToFile, fetchDownloadUrls, ingestZipFile } from "@/lib/abnBulkIngest";
import { AbnRunReporter, type AbnRunPhase } from "@/lib/abnDirectoryRun";
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

async function ingest(admin: ReturnType<typeof createAdminClient>, reporter: AbnRunReporter) {
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

  let inserted = 0;
  const dir = await mkdtemp(path.join(tmpdir(), "abn-bulk-"));
  try {
    for (let index = split - 1; index < urls.length; index++) {
      const url = urls[index];
      const dest = path.join(dir, `split-${index + 1}.zip`);
      const label = `Downloading split ${index + 1} of ${urls.length}`;
      console.log(`[abn] ${label}: ${url}`);
      await reporter.progress({ message: label, candidates_inserted: inserted }, true);
      await downloadToFile(url, dest);
      const startEntry = index === split - 1 ? internal : 0;
      await reporter.progress({
        message: `Parsing split ${index + 1} of ${urls.length}`,
        candidates_inserted: inserted,
      }, true);
      const fileTotals = await ingestZipFile(dest, admin, {
        startEntryIndex: startEntry,
        onBatch: async (snapshot) => {
          await reporter.progress({
            message: `Parsing ${snapshot.entry}: ${inserted + snapshot.candidatesInserted} trade candidates inserted this run`,
            candidates_inserted: inserted + snapshot.candidatesInserted,
          });
        },
        onFile: async (entryIndex, entryName, result) => {
          inserted += result.candidatesInserted;
          await admin.from("abn_ingest_cursor").upsert({
            id: 1,
            split_file_index: index + 1,
            internal_file_index: entryIndex + 1,
            records_processed_in_file: 0,
            last_run_at: new Date().toISOString(),
          });
          await reporter.progress({
            message: `Finished ${entryName}. ${inserted} trade candidates inserted this run.`,
            candidates_inserted: inserted,
          }, true);
        },
      });
      console.log(`[abn] split ${index + 1} inserted ${fileTotals.candidatesInserted} candidates`);
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
  return inserted;
}

async function enrich(reporter: AbnRunReporter) {
  const limit = Number(process.env.ABN_ENRICH_LIMIT ?? "800");
  let processed = 0;
  let created = 0;
  while (processed < limit) {
    const batch = await runAbnEnrichmentBatch({ batchSize: 40, concurrency: 6, maxBatches: 1 });
    processed += batch.processed;
    created += batch.listingsCreated;
    console.log(`[abn] enrich processed ${batch.processed}, created ${batch.listingsCreated}, remaining ${batch.remaining}`);
    await reporter.progress({
      message: `Guessing websites: ${processed} candidates processed, ${created} listings created.`,
      candidates_processed: processed,
      listings_created: created,
    }, true);
    if (batch.processed === 0) break;
  }
  console.log(`[abn] enrich done: processed ${processed}, listings created ${created}`);
  return { processed, created };
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
  const admin = createAdminClient();
  const reporter = new AbnRunReporter(
    admin,
    process.env.ABN_DIRECTORY_RUN_ID?.trim() || null,
    {
      runId: process.env.GITHUB_RUN_ID ?? null,
      runUrl: process.env.GITHUB_RUN_URL ?? null,
    },
  );
  await reporter.ensure(phase as AbnRunPhase);
  try {
    let inserted = 0;
    let created = 0;
    let processed = 0;
    if (phase === "all" || phase === "ingest") inserted = await ingest(admin, reporter);
    if (phase === "all" || phase === "enrich") {
      const enriched = await enrich(reporter);
      created = enriched.created;
      processed = enriched.processed;
    }
    if (phase === "all" || phase === "verify") {
      await reporter.progress({ message: "Checking ABN status and email MX records." }, true);
      await verify();
    }
    const summary = [`Finished ${phase}.`];
    if (phase === "all" || phase === "ingest") summary.push(`${inserted} candidates inserted.`);
    if (phase === "all" || phase === "enrich") summary.push(`${created} listings created from ${processed} candidates.`);
    await reporter.finish(summary.join(" "));
  } catch (err) {
    await reporter.fail(err);
    throw err;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
