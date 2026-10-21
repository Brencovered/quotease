/**
 * Writes progress into abn_directory_runs. The admin page polls that
 * table. A missing table (migration not applied yet) is reported and
 * does not throw, so a local pipeline run still finishes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AbnRunPhase = "all" | "ingest" | "enrich" | "verify";
export type AbnRunStatus = "queued" | "running" | "done" | "failed";

export interface AbnRunPatch {
  status?: AbnRunStatus;
  phase?: AbnRunPhase;
  message?: string;
  error?: string | null;
  github_run_id?: string | null;
  github_run_url?: string | null;
  candidates_inserted?: number;
  listings_created?: number;
  candidates_processed?: number;
  started_at?: string;
  finished_at?: string | null;
  triggered_by?: string | null;
}

export function schemaNotReady(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "42703") return true;
  const message = error.message ?? "";
  return /abn_directory_runs|abn_trade_candidates|schema cache|does not exist|could not find/i.test(message);
}

export function migrationHint(): string {
  return "Apply supabase/migrations/20261021140000_abn_directory_runs.sql in the Supabase SQL editor. It creates abn_directory_runs and adds created_at on abn_trade_candidates. Nothing else in that file deletes data.";
}

const PROGRESS_INTERVAL_MS = 3000;

export class AbnRunReporter {
  private lastWrite = 0;
  id: string | null;

  constructor(
    private admin: SupabaseClient,
    runId: string | null,
    private github: { runId: string | null; runUrl: string | null },
  ) {
    this.id = runId;
  }

  async ensure(phase: AbnRunPhase): Promise<void> {
    const now = new Date().toISOString();
    const patch: AbnRunPatch = {
      status: "running",
      phase,
      message: "GitHub Actions runner started.",
      github_run_id: this.github.runId,
      github_run_url: this.github.runUrl,
      started_at: now,
    };
    if (this.id) {
      const { error } = await this.admin.from("abn_directory_runs").update({ ...patch, updated_at: now }).eq("id", this.id);
      if (error) {
        if (schemaNotReady(error)) {
          console.error(`[abn-run] ${migrationHint()}`);
          return;
        }
        console.error("[abn-run] could not mark running:", error.message);
      }
      this.lastWrite = Date.now();
      return;
    }
    const createdId = crypto.randomUUID();
    const { error } = await this.admin.from("abn_directory_runs").insert({
      id: createdId,
      ...patch,
      triggered_by: "github-actions",
      updated_at: now,
    });
    if (error) {
      console.error("[abn-run] could not insert run:", error.message);
      return;
    }
    this.id = createdId;
    this.lastWrite = Date.now();
  }

  async progress(patch: AbnRunPatch, force = false): Promise<void> {
    if (!this.id) return;
    const now = Date.now();
    if (!force && now - this.lastWrite < PROGRESS_INTERVAL_MS) return;
    this.lastWrite = now;
    const { error } = await this.admin.from("abn_directory_runs").update({
      ...patch,
      updated_at: new Date().toISOString(),
    }).eq("id", this.id);
    if (error) console.error("[abn-run] progress update failed:", error.message);
  }

  async finish(message: string): Promise<void> {
    await this.progress({ status: "done", message, finished_at: new Date().toISOString(), error: null }, true);
  }

  async fail(err: unknown): Promise<void> {
    const text = err instanceof Error ? err.message : String(err);
    await this.progress({
      status: "failed",
      message: "The pipeline stopped with an error.",
      error: text.slice(0, 2000),
      finished_at: new Date().toISOString(),
    }, true);
  }
}
