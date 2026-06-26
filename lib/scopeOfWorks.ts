export function humanizeIntake(intake: Record<string, unknown> | null | undefined): string[] {
  if (!intake) return [];
  const SKIP = new Set(["jobType", "notes"]);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(intake)) {
    if (SKIP.has(key)) continue;
    if (value === null || value === undefined || value === "" || value === false) continue;
    if (typeof value === "number" && value === 0) continue;
    if (Array.isArray(value) || typeof value === "object") continue;
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
    lines.push(typeof value === "boolean" ? label : `${label}: ${value}`);
  }
  return lines;
}
