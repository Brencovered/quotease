/**
 * One path shape for public URLs: no trailing slash, except the paths
 * that must keep one. Next is configured with skipTrailingSlashRedirect
 * so PostHog's /ingest routes are not rewritten; without an explicit
 * redirect, /electricians-box-hill-vic and /electricians-box-hill-vic/
 * both return 200.
 */
export function canonicalRequestPath(pathname: string): string {
  if (pathname.length <= 1 || !pathname.endsWith("/")) return pathname;
  if (pathname.startsWith("/ingest") || pathname.startsWith("/api/")) return pathname;
  const stripped = pathname.replace(/\/+$/, "");
  return stripped || "/";
}
