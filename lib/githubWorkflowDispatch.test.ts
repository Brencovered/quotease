import { describe, expect, it, vi } from "vitest";
import {
  dispatchAbnWorkflow,
  dispatchSetupErrors,
  explainGithubDispatchFailure,
  pickDispatchedRun,
  statusFromGithubRun,
  type WorkflowRunSummary,
} from "./githubWorkflowDispatch";

function run(partial: Partial<WorkflowRunSummary> & Pick<WorkflowRunSummary, "id" | "created_at">): WorkflowRunSummary {
  return {
    html_url: `https://github.com/Brencovered/quotease/actions/runs/${partial.id}`,
    status: "queued",
    event: "workflow_dispatch",
    ...partial,
  };
}

describe("dispatchSetupErrors", () => {
  it("names the missing token", () => {
    const errors = dispatchSetupErrors({ token: "", repository: "Brencovered/quotease", ref: "main" });
    expect(errors[0]).toContain("GITHUB_ACTIONS_DISPATCH_TOKEN");
    expect(errors[0]).toContain("Actions");
  });

  it("rejects a repository that is not owner/name", () => {
    const errors = dispatchSetupErrors({ token: "ghp_example", repository: "https://evil.example", ref: "main" });
    expect(errors.some((error) => error.includes("GITHUB_REPOSITORY"))).toBe(true);
  });
});

describe("explainGithubDispatchFailure", () => {
  it("explains auth and missing workflow responses", () => {
    expect(explainGithubDispatchFailure(401, "")).toContain("GITHUB_ACTIONS_DISPATCH_TOKEN");
    expect(explainGithubDispatchFailure(403, "")).toContain("Actions write");
    expect(explainGithubDispatchFailure(404, "")).toContain("abn-directory");
    expect(explainGithubDispatchFailure(422, "unexpected input")).toContain("run_id");
  });
});

describe("statusFromGithubRun", () => {
  it("maps a finished Actions run onto the directory run status", () => {
    expect(statusFromGithubRun({ status: "queued", conclusion: null })).toBeNull();
    expect(statusFromGithubRun({ status: "in_progress", conclusion: null })).toBe("running");
    expect(statusFromGithubRun({ status: "completed", conclusion: "success" })).toBe("done");
    expect(statusFromGithubRun({ status: "completed", conclusion: "failure" })).toBe("failed");
  });
});

describe("pickDispatchedRun", () => {
  it("returns the newest queued dispatch created after the click", () => {
    const now = Date.parse("2026-10-21T04:00:10.000Z");
    const chosen = pickDispatchedRun([
      run({ id: 1, created_at: "2026-10-21T03:00:00.000Z", status: "completed" }),
      run({ id: 2, created_at: "2026-10-21T04:00:08.000Z" }),
      run({ id: 3, created_at: "2026-10-21T04:00:09.000Z", event: "schedule" }),
    ], now);
    expect(chosen?.id).toBe(2);
  });
});

describe("dispatchAbnWorkflow", () => {
  it("returns the token error without calling GitHub", async () => {
    const fetchImpl = vi.fn();
    const result = await dispatchAbnWorkflow(
      { token: "", repository: "Brencovered/quotease", ref: "main" },
      { phase: "ingest", runId: "run-1" },
      { fetchImpl },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("GITHUB_ACTIONS_DISPATCH_TOKEN");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts the phase and run id, then attaches the Actions URL", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({
        workflow_runs: [run({ id: 44, created_at: new Date().toISOString() })],
      }));
    const result = await dispatchAbnWorkflow(
      { token: "ghp_example", repository: "Brencovered/quotease", ref: "main" },
      { phase: "all", runId: "run-9" },
      { fetchImpl, sleep: async () => {} },
    );
    expect(result).toEqual({
      ok: true,
      githubRunUrl: "https://github.com/Brencovered/quotease/actions/runs/44",
      githubRunId: "44",
    });
    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual({
      ref: "main",
      inputs: { phase: "all", run_id: "run-9" },
    });
    expect(String(init.headers.Authorization)).toBe("Bearer ghp_example");
  });

  it("turns a 404 into a merge hint", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const result = await dispatchAbnWorkflow(
      { token: "ghp_example", repository: "Brencovered/quotease", ref: "main" },
      { phase: "ingest", runId: "run-2" },
      { fetchImpl },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Merge");
  });
});
