// Turns a raw variance number into something that actually changes how the
// next quote gets built - not just "you went over," but a plausible reason
// tied to conditions that were already on this job, when one's available.
// Heuristic and free (no AI call) - the point is a fast, deterministic
// nudge, not a perfectly-reasoned diagnosis.
export function generateCostingInsight(
  hoursVar: number,
  quotedHours: number,
  intakeData: Record<string, unknown> | null | undefined
): string | null {
  if (quotedHours <= 0) return null;
  const pctOver = (hoursVar / quotedHours) * 100;

  if (pctOver < 12) return null; // close enough to not be worth flagging

  const reasons: string[] = [];
  const roof = intakeData?.roofAccess;
  const subfloor = intakeData?.subfloorAccess;
  if (typeof roof === "number" && roof > 1.3) reasons.push("roof access");
  if (typeof subfloor === "number" && subfloor > 1.3) reasons.push("subfloor access");
  if (intakeData?.multistorey) reasons.push("multi-storey access");
  if (intakeData?.ceilingType === "concrete_slab" || intakeData?.ceilingType === "Concrete slab") {
    reasons.push("concrete slab ceiling");
  }

  const overText = `Ran ${Math.round(pctOver)}% over on labour`;
  if (reasons.length > 0) {
    return `${overText} - likely the ${reasons.join(" and ")} on this one. Worth bumping that multiplier slightly next time you quote similar conditions.`;
  }
  return `${overText} than quoted. Worth a quick note on what made this one slower, so future quotes for similar jobs land closer to reality.`;
}
