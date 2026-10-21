import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAbnEnrichmentBatch } from "@/lib/abnDirectoryEnrichment";
import { migrationHint, schemaNotReady } from "@/lib/abnDirectoryRun";
import {
  dispatchAbnWorkflow,
  dispatchConfigFromEnv,
  dispatchSetupErrors,
  readWorkflowRun,
  statusFromGithubRun,
  type AbnWorkflowPhase,
} from "@/lib/githubWorkflowDispatch";

// Phase 2 guesses websites for 50 candidates. That stays inside this
// function. Phase 1 is the ABR bulk extract, which is too large for a
// Vercel function, so the buttons below start the free GitHub Actions
// workflow instead.
export const maxDuration = 300;

async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  return { email: user.email ?? "admin" };
}

function isResponse(value: { email: string } | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export async function GET() {
  const auth = await requireAdmin();
  if (isResponse(auth)) return auth;

  const admin = createAdminClient();
  const setupErrors = dispatchSetupErrors(dispatchConfigFromEnv());

  const [
    totalResult,
    unprocessedResult,
    listingsCreatedResult,
    cursorResult,
    runsResult,
    candidatesResult,
    listingsResult,
  ] = await Promise.all([
    admin.from("abn_trade_candidates").select("id", { count: "exact", head: true }),
    admin.from("abn_trade_candidates").select("id", { count: "exact", head: true }).is("processed_at", null),
    admin.from("abn_trade_candidates").select("id", { count: "exact", head: true }).not("directory_listing_id", "is", null),
    admin.from("abn_ingest_cursor").select("split_file_index, internal_file_index, last_run_at").eq("id", 1).maybeSingle(),
    admin.from("abn_directory_runs").select("*").order("created_at", { ascending: false }).limit(5),
    admin.from("abn_trade_candidates")
      .select("id, abn, legal_name, trading_name, matched_trade, state, postcode, website_url_found, directory_listing_id, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    admin.from("directory_listing")
      .select("id, business_name, trades, suburb, website_url, abn, verified_at, verification_source, email_valid, created_at")
      .eq("source", "abn_bulk_extract")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const migrationErrors = [runsResult.error, candidatesResult.error].filter(schemaNotReady);
  const setup = [...setupErrors];
  if (migrationErrors.length > 0) setup.push(migrationHint());

  const runs = runsResult.data ?? [];
  let activeRun = runs.find((run) => run.status === "queued" || run.status === "running") ?? null;
  if (activeRun?.github_run_id) {
    const remote = await readWorkflowRun(dispatchConfigFromEnv(), String(activeRun.github_run_id));
    const nextStatus = remote ? statusFromGithubRun(remote) : null;
    if (remote && nextStatus && nextStatus !== activeRun.status) {
      const patch: Record<string, string | null> = {
        status: nextStatus,
        github_run_url: remote.html_url,
        updated_at: new Date().toISOString(),
      };
      if (nextStatus === "done") {
        patch.message = activeRun.message || "GitHub Actions reported success.";
        patch.finished_at = new Date().toISOString();
        patch.error = null;
      }
      if (nextStatus === "failed") {
        patch.message = "GitHub Actions reported this run as failed. Open the log for the step that stopped.";
        patch.finished_at = new Date().toISOString();
        patch.error = activeRun.error || `GitHub conclusion: ${remote.conclusion ?? "unknown"}`;
      }
      await admin.from("abn_directory_runs").update(patch).eq("id", activeRun.id);
      activeRun = { ...activeRun, ...patch };
    }
  }

  return NextResponse.json({
    totalCandidates: totalResult.count ?? 0,
    unprocessed: unprocessedResult.count ?? 0,
    listingsCreated: listingsCreatedResult.count ?? 0,
    ingestCursor: cursorResult.data ?? null,
    migrationReady: migrationErrors.length === 0,
    setupErrors: setup,
    activeRun,
    recentRuns: runs,
    recentCandidates: candidatesResult.data ?? [],
    recentListings: listingsResult.data ?? [],
    listingsError: listingsResult.error && !schemaNotReady(listingsResult.error) ? listingsResult.error.message : null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isResponse(auth)) return auth;

  const body = await req.json().catch(() => ({}));
  const phase = body.phase === "ingest" || body.phase === "all" || body.phase === "verify"
    ? body.phase
    : "enrich";

  if (phase === "enrich") {
    try {
      const result = await runAbnEnrichmentBatch();
      return NextResponse.json({ phase, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Phase 2 failed.";
      return NextResponse.json({ phase, error: message }, { status: 500 });
    }
  }

  const config = dispatchConfigFromEnv();
  const setupErrors = dispatchSetupErrors(config);
  if (setupErrors.length > 0) {
    return NextResponse.json({ phase, error: setupErrors.join(" ") }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: active, error: activeError } = await admin
    .from("abn_directory_runs")
    .select("id, status, github_run_url, message")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (activeError) {
    const error = schemaNotReady(activeError)
      ? migrationHint()
      : activeError.message;
    return NextResponse.json({ phase, error }, { status: schemaNotReady(activeError) ? 503 : 500 });
  }
  if (active && active.length > 0) {
    const current = active[0];
    return NextResponse.json({
      phase,
      error: `A run is already ${current.status}. GitHub runs one abn-directory job at a time. Wait for it to finish, or open the Actions log if it looks stuck.`,
      activeRun: current,
    }, { status: 409 });
  }

  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error: insertError } = await admin.from("abn_directory_runs").insert({
    id: runId,
    phase,
    status: "queued",
    message: "Queued. Waiting for GitHub Actions to pick up the job.",
    triggered_by: auth.email,
    updated_at: now,
  });
  if (insertError) {
    const error = schemaNotReady(insertError) ? migrationHint() : insertError.message;
    return NextResponse.json({ phase, error }, { status: schemaNotReady(insertError) ? 503 : 500 });
  }

  const dispatched = await dispatchAbnWorkflow(config, { phase: phase as AbnWorkflowPhase, runId });
  if (!dispatched.ok) {
    await admin.from("abn_directory_runs").update({
      status: "failed",
      error: dispatched.error,
      message: "GitHub did not start the workflow.",
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
    return NextResponse.json({ phase, error: dispatched.error, runId }, { status: dispatched.status === 400 ? 400 : 502 });
  }

  if (dispatched.githubRunUrl) {
    await admin.from("abn_directory_runs").update({
      github_run_url: dispatched.githubRunUrl,
      github_run_id: dispatched.githubRunId,
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
  }

  return NextResponse.json({
    phase,
    runId,
    status: "queued",
    githubRunUrl: dispatched.githubRunUrl,
  });
}
