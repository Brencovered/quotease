/**
 * lib/posthog-server.ts
 * ----------------------
 * Server-side PostHog HogQL querying for internal admin dashboards.
 *
 * This is deliberately separate from components/PostHogProvider.tsx, which
 * only ever sends events (the public project API key, safe client-side).
 * Reading data back out requires a Personal API Key, which is private and
 * must never reach the browser - every call in this file runs on the
 * server only (route handlers / server components), never in a "use
 * client" file.
 *
 * Get a Personal API Key at app.posthog.com > Settings > Personal API Keys
 * (needs the "Query read" scope, project-scoped to this project is
 * enough) and set it as POSTHOG_PERSONAL_API_KEY in Vercel. Without it,
 * every function here throws a clear error rather than failing silently -
 * an admin analytics page with no data and no explanation is worse than
 * one that says exactly what's missing.
 */

const PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "572333";

function apiHost(): string {
  const region = (process.env.POSTHOG_REGION || "us").toLowerCase();
  return region === "eu" ? "https://eu.posthog.com" : "https://us.posthog.com";
}

export type HogQLResult = {
  columns: string[];
  results: unknown[][];
};

/**
 * Runs a raw HogQL query against this project and returns rows as an
 * array of plain objects keyed by column name - easier to work with in
 * page code than the raw {columns, results} shape PostHog's API returns.
 */
export async function runHogQL<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!key) {
    throw new Error(
      "POSTHOG_PERSONAL_API_KEY is not set. Add a Personal API Key (Query read scope) " +
      "in Vercel env vars - see lib/posthog-server.ts for where to generate one."
    );
  }

  const res = await fetch(`${apiHost()}/api/projects/${PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    // Always fresh - this is a live traffic dashboard, not something that
    // should ever serve a stale cached response.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PostHog query failed (${res.status}): ${body.slice(0, 500)}`);
  }

  const data: HogQLResult = await res.json();
  const columns = data.columns ?? [];
  return (data.results ?? []).map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj as T;
  });
}
