/** Suggested hours from a work clock start, 15-min steps, 0.25-16h cap. */
export function suggestHoursFromStart(startedAtIso: string | null | undefined, nowMs = Date.now()): number | null {
  if (!startedAtIso) return null;
  const startedAt = new Date(startedAtIso);
  if (Number.isNaN(startedAt.getTime())) return null;
  const hoursRaw = (nowMs - startedAt.getTime()) / 3600000;
  if (hoursRaw < 0.05) return 0.25;
  return Math.round(Math.min(Math.max(hoursRaw, 0.25), 16) * 4) / 4;
}

export function melbourneDayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Melbourne",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}
