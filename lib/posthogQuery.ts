/**
 * lib/posthogQuery.ts
 * ----------------------
 * Server-side runner for PostHog's HogQL Query API - used to pull
 * per-listing traffic stats for the tradie-facing traffic dashboard
 * (Settings > Directory).
 *
 * This is a genuinely different credential from NEXT_PUBLIC_POSTHOG_KEY
 * (the client-side ingestion key already used by
 * components/PostHogProvider.tsx to send events *to* PostHog) - that
 * key cannot read data back out. This needs a Personal API Key with
 * "query:read" scope, created in PostHog under Settings > Personal
 * API keys, plus the numeric project ID (visible in the PostHog
 * project URL). Both need to be set as POSTHOG_PERSONAL_API_KEY and
 * POSTHOG_PROJECT_ID - a manual one-time setup step, not something
 * fixable through code.
 *
 * Confirmed API contract before writing this (not guessed): POST to
 * {host}/api/projects/{project_id}/query/ with an Authorization:
 * Bearer header and a { query: { kind: "HogQLQuery", query: "..." } }
 * body, response includes a `results` array of row arrays matching
 * the SELECT column order. Reuses the same POSTHOG_REGION env var
 * next.config.ts already reads for ingestion routing, so the two
 * stay in sync automatically if the project is ever migrated between
 * US/EU cloud.
 */

const POSTHOG_HOST = `https://${process.env.POSTHOG_REGION === "eu" ? "eu" : "us"}.posthog.com`;

export interface HogQLResult {
  results: unknown[][];
  columns?: string[];
}

export async function runHogQLQuery(query: string): Promise<HogQLResult | null> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.error("[posthogQuery] POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID not set - traffic sync cannot run until both are configured (see lib/posthogQuery.ts header for setup steps)");
    return null;
  }

  try {
    const res = await fetch(`${POSTHOG_HOST}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: { kind: "HogQLQuery", query },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[posthogQuery] query failed: ${res.status} ${res.statusText} - ${body.slice(0, 500)}`);
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data.results)) {
      console.error(`[posthogQuery] unexpected response shape - no results array: ${JSON.stringify(data).slice(0, 500)}`);
      return null;
    }

    return { results: data.results, columns: data.columns };
  } catch (err) {
    console.error("[posthogQuery] request threw:", err instanceof Error ? err.message : err);
    return null;
  }
}
