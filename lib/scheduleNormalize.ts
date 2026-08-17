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
