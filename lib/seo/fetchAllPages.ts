/**
 * PostgREST (what Supabase uses) silently returns at most 1,000 rows for a
 * select that does not set an explicit range. Callers that need every
 * eligible row have to page. A full page is not the end of the table: the
 * next request is required, and only a short page (or an empty one) stops
 * the scan.
 *
 * `fetchPage` must apply a stable unique order (for example `id`) and
 * return at most `pageSize` rows for the inclusive window starting at
 * `from`. Errors propagate. Treating a failed page as "no more rows" is
 * how a sitemap publishes a confident, truncated URL set.
 */
export const POSTGREST_PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  fetchPage: (from: number, pageSize: number) => Promise<readonly T[]>,
  pageSize = POSTGREST_PAGE_SIZE,
): Promise<T[]> {
  if (pageSize < 1) throw new Error("pageSize must be at least 1");
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, pageSize);
    if (page.length === 0) break;
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}
