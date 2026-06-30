/**
 * lib/seo/searchConsole.ts
 * -------------------------
 * Thin wrapper around the Google Search Console API (the modern
 * replacement for the deprecated sitemap-ping endpoint).
 *
 * STATUS: scaffold only. This will throw a clear error if called right
 * now, because none of the prerequisites exist yet:
 *
 *   1. A Google Cloud project with the Search Console API enabled.
 *   2. A service account in that project, with its JSON key stored as
 *      the GOOGLE_SERVICE_ACCOUNT_KEY env var (raw JSON string).
 *   3. That service account's email address added as a (at least)
 *      "Restricted" user on the swiftscope.com.au property inside
 *      Google Search Console itself (Settings -> Users and permissions
 *      -> Add user). This step can't be automated -- it's a manual
 *      one-time action in the Search Console UI.
 *   4. The `googleapis` npm package is NOT used here on purpose --
 *      not currently a project dependency, so these functions sign a
 *      JWT manually and call the REST API directly with fetch, to avoid
 *      adding the dependency before it's actually needed.
 *
 * Until all three setup steps exist, every exported function here will
 * throw immediately with a message pointing at this comment block,
 * rather than silently failing or doing nothing.
 */

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

function getServiceAccount(): ServiceAccountKey {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "[searchConsole] GOOGLE_SERVICE_ACCOUNT_KEY is not set. This integration is scaffolded but not " +
      "configured -- see the comment block at the top of lib/seo/searchConsole.ts for the setup steps " +
      "(Google Cloud project, service account, Search Console property access, env var)."
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("[searchConsole] GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON.");
  }
}

/**
 * Mints a short-lived OAuth2 access token for the service account using
 * the JWT bearer flow, without pulling in the `googleapis` package.
 * Scope is read/write Search Console -- sufficient for sitemap submission
 * and the (limited) Search Analytics query API.
 */
async function getAccessToken(): Promise<string> {
  const account = getServiceAccount();

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/webmasters",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const base64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const unsigned = `${base64url(header)}.${base64url(claims)}`;

  const crypto = await import("crypto");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(account.private_key).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`[searchConsole] Failed to mint access token: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

const SITE_URL = "https://swiftscope.com.au/";
const SC_API = "https://www.googleapis.com/webmasters/v3/sites";

/**
 * Submits (or re-submits) the sitemap to Search Console. This is the
 * correct modern replacement for the deprecated sitemap-ping endpoint --
 * Google will recrawl the sitemap on its own schedule after this, same as
 * if you'd clicked "Submit" in the Search Console UI.
 */
export async function submitSitemap(sitemapUrl = `${SITE_URL}sitemap.xml`): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(
    `${SC_API}/${encodeURIComponent(SITE_URL)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`[searchConsole] submitSitemap failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Fetches basic Search Analytics (clicks/impressions/position) for the
 * property over a date range. Useful for a future "which pages are
 * actually getting search traffic" admin view.
 */
export async function getSearchAnalytics(opts: {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  dimensions?: ("page" | "query" | "country" | "device")[];
  rowLimit?: number;
}): Promise<Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>> {
  const token = await getAccessToken();
  const res = await fetch(
    `${SC_API}/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: opts.startDate,
        endDate: opts.endDate,
        dimensions: opts.dimensions ?? ["page"],
        rowLimit: opts.rowLimit ?? 100,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`[searchConsole] getSearchAnalytics failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.rows ?? [];
}

/**
 * NOTE ON THE INDEXING API: Google's separate "Indexing API"
 * (indexing.googleapis.com) only works for pages marked up as JobPosting
 * or BroadcastEvent structured data -- using it for ordinary pages like
 * these trade x suburb landing pages violates Google's terms and won't
 * get them crawled any faster anyway (Google has been explicit about
 * this publicly). Deliberately NOT scaffolding a requestIndexing()
 * function here -- submitSitemap() + normal organic crawling is the
 * correct and only legitimate path for this content type.
 */
