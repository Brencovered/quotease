/**
 * Start the free abn-directory GitHub Actions workflow from the server.
 *
 * The ABR bulk extract is too large for a Vercel function (a previous
 * in-function download died on the timeout and inserted nothing). Actions
 * is the free runner: one download, stream-parse, bulk insert.
 *
 * Token (server env only, never commit it):
 *   GITHUB_ACTIONS_DISPATCH_TOKEN
 *     Fine-grained personal access token: repository access to this repo,
 *     Actions read and write.
 *     Classic token: the `workflow` scope (and access to the repo).
 *
 * Optional:
 *   GITHUB_REPOSITORY   owner/name, default Brencovered/quotease
 *   ABN_WORKFLOW_REF    git ref to run, default main
 *     The workflow file on that ref is what GitHub runs. Merge this
 *     change to that branch before expecting the live progress row to update.
 */

const WORKFLOW_FILE = "abn-directory.yml";
const DEFAULT_REPOSITORY = "Brencovered/quotease";
const DEFAULT_REF = "main";

export type AbnWorkflowPhase = "all" | "ingest" | "enrich" | "verify";

export interface DispatchConfig {
  token: string;
  repository: string;
  ref: string;
}

export interface WorkflowRunSummary {
  id: number;
  html_url: string;
  status: string;
  created_at: string;
  event: string;
}

export function dispatchConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DispatchConfig {
  return {
    token: env.GITHUB_ACTIONS_DISPATCH_TOKEN?.trim() ?? "",
    repository: env.GITHUB_REPOSITORY?.trim() || DEFAULT_REPOSITORY,
    ref: env.ABN_WORKFLOW_REF?.trim() || DEFAULT_REF,
  };
}

export function dispatchSetupErrors(config: DispatchConfig): string[] {
  const errors: string[] = [];
  if (!config.token) {
    errors.push(
      "GITHUB_ACTIONS_DISPATCH_TOKEN is not set on the server. Add it in Vercel (or .env.local). Use a GitHub token with Actions read and write on this repository (fine-grained: Actions Read and write; classic: the workflow scope). Do not commit the token.",
    );
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository)) {
    errors.push("GITHUB_REPOSITORY must look like owner/name.");
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(config.ref)) {
    errors.push("ABN_WORKFLOW_REF must be a branch, tag, or commit SHA.");
  }
  return errors;
}

export function explainGithubDispatchFailure(status: number, body: string): string {
  const message = body.replace(/\s+/g, " ").trim().slice(0, 300);
  if (status === 401) {
    return "GitHub rejected GITHUB_ACTIONS_DISPATCH_TOKEN (401). Create a new token with Actions read and write on this repository and update the server env var.";
  }
  if (status === 403) {
    return "GitHub refused to start the workflow (403). The token needs Actions write on this repository. Fine-grained tokens need the Actions permission set to Read and write; classic tokens need the workflow scope.";
  }
  if (status === 404) {
    return "GitHub could not find the abn-directory workflow on that repository or ref (404). Merge this branch to the ref in ABN_WORKFLOW_REF (default main), and check GITHUB_REPOSITORY.";
  }
  if (status === 422) {
    return `GitHub could not accept the workflow inputs (422). The workflow file on the default branch has to include the phase and run_id inputs. Merge first, then try again. ${message}`.trim();
  }
  return `GitHub workflow dispatch failed (${status}). ${message}`.trim();
}

export function statusFromGithubRun(run: { status: string; conclusion: string | null }): "running" | "done" | "failed" | null {
  if (run.status === "in_progress") return "running";
  if (run.status !== "completed") return null;
  return run.conclusion === "success" ? "done" : "failed";
}

export function pickDispatchedRun(runs: WorkflowRunSummary[], dispatchedAtMs: number): WorkflowRunSummary | null {
  const cutoff = dispatchedAtMs - 5000;
  const matches = runs
    .filter((run) => run.event === "workflow_dispatch")
    .filter((run) => Date.parse(run.created_at) >= cutoff)
    .filter((run) => run.status === "queued" || run.status === "in_progress" || run.status === "waiting" || run.status === "pending")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return matches[0] ?? null;
}

interface DispatchDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface DispatchResult {
  ok: true;
  githubRunUrl: string | null;
  githubRunId: string | null;
}

export interface DispatchFailure {
  ok: false;
  status: number;
  error: string;
}

export async function dispatchAbnWorkflow(
  config: DispatchConfig,
  input: { phase: AbnWorkflowPhase; runId: string },
  deps: DispatchDeps = {},
): Promise<DispatchResult | DispatchFailure> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const setupErrors = dispatchSetupErrors(config);
  if (setupErrors.length > 0) {
    return { ok: false, status: 400, error: setupErrors.join(" ") };
  }

  const dispatchedAt = Date.now();
  const url = `https://api.github.com/repos/${config.repository}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "swiftscope-abn-directory",
      },
      body: JSON.stringify({
        ref: config.ref,
        inputs: { phase: input.phase, run_id: input.runId },
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    return { ok: false, status: 502, error: `Could not reach the GitHub API. ${message}` };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false, status: response.status, error: explainGithubDispatchFailure(response.status, body) };
  }

  const found = await findRun(config, fetchImpl, sleep, dispatchedAt);
  return { ok: true, githubRunUrl: found?.html_url ?? null, githubRunId: found ? String(found.id) : null };
}

export async function readWorkflowRun(
  config: DispatchConfig,
  githubRunId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: string; conclusion: string | null; html_url: string } | null> {
  if (!config.token || !githubRunId) return null;
  if (!/^\d+$/.test(githubRunId)) return null;
  try {
    const response = await fetchImpl(`https://api.github.com/repos/${config.repository}/actions/runs/${githubRunId}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "swiftscope-abn-directory",
      },
    });
    if (!response.ok) return null;
    const body = await response.json() as { status?: string; conclusion?: string | null; html_url?: string };
    if (!body.status || !body.html_url) return null;
    return { status: body.status, conclusion: body.conclusion ?? null, html_url: body.html_url };
  } catch {
    return null;
  }
}

async function findRun(
  config: DispatchConfig,
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>,
  dispatchedAt: number,
): Promise<WorkflowRunSummary | null> {
  const url = `https://api.github.com/repos/${config.repository}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=5`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(1500);
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${config.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "swiftscope-abn-directory",
        },
      });
      if (!response.ok) return null;
      const body = await response.json() as { workflow_runs?: WorkflowRunSummary[] };
      const match = pickDispatchedRun(body.workflow_runs ?? [], dispatchedAt);
      if (match) return match;
    } catch {
      return null;
    }
  }
  return null;
}
