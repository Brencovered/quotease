/**
 * SwiftScope's calendar day boundary is fixed to Australia/Melbourne,
 * regardless of what timezone the viewing device is set to. Every place
 * that buckets a job/event into a calendar day (month grid, crew week
 * columns, list view, "today" highlighting) must derive its date key
 * through this function -- never through toISOString() (UTC) or
 * toLocaleDateString() (browser-local), since mixing those with this one
 * is exactly what causes a job to land on a different day in one view
 * than another.
 */
export function businessDateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Normalize preferred start / calendar dates onto jobs.scheduled_start.
 * Prefer an existing timestamptz; otherwise promote a date-only value to
 * local midnight ISO so the calendar and board both see it.
 */
export function resolveScheduledStart(
  scheduledStart: string | null | undefined,
  scheduledDate: string | null | undefined
): string | null {
  if (scheduledStart) return scheduledStart;
  if (!scheduledDate) return null;
  // Date-only YYYY-MM-DD → treat as start of that day in local interpretation
  // (ISO date at T00:00:00.000Z is fine for calendar day bucketing).
  if (/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return `${scheduledDate}T00:00:00.000Z`;
  }
  return new Date(scheduledDate).toISOString();
}

export function endFromStartAndDays(startIso: string, days: number | null | undefined): string | null {
  if (!days || days <= 1) return startIso;
  return new Date(new Date(startIso).getTime() + (days - 1) * 86400000).toISOString();
}
