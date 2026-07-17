import { INTAKE_FIELD_LABELS, INTAKE_VALUE_LABELS } from "./humanizeIntake";

// Fields to completely skip in scope display
const SKIP = new Set([
  "jobType", "notes", "ceilingType", "manual_labour_hours", // internal calc only
  "roofAccess", "subfloorAccess",           // shown as access conditions not scope items
  "roofAccessNote", "subfloorAccessNote", "siteAccessNote", // custom-access free text, not scope items
  "siteAccess", "multistorey",              // conditions not scope items
  "switchboardRcbo", "switchboardRcboMode", // rolled into switchboard line
  "switchboardPoles",                       // rolled into switchboard line
  "downlightGrade", "downlightSupply",      // rolled into downlight line
  "downlightProvisional",                   // rolled into downlight line
]);

export function humanizeIntake(intake: Record<string, unknown> | null | undefined): string[] {
  if (!intake) return [];
  const lines: string[] = [];

  // Handle switchboard as a single composed line
  if (intake.switchboardUpgrade) {
    if (intake.switchboardRcbo) {
      const mode = intake.switchboardRcboMode;
      if (mode === "per_pole") {
        lines.push(`Switchboard upgrade - RCBO per pole (${intake.switchboardPoles ?? 12} poles)`);
      } else {
        lines.push("Switchboard upgrade - full RCBO board");
      }
    } else {
      lines.push("Switchboard upgrade - RCD");
    }
  }

  // Handle downlights as a single composed line
  if (typeof intake.downlights === "number" && intake.downlights > 0) {
    const supply = intake.downlightSupply as string;
    const grade  = intake.downlightGrade as string;
    const gradeLabel = grade === "builder" ? "builder grade" : grade === "standard" ? "standard" : grade === "premium" ? "premium" : "client supply";
    if (supply === "wire_and_fit") {
      lines.push(`Downlights: ${intake.downlights} × wire & fit (client supply)`);
    } else if (supply === "provisional") {
      lines.push(`Downlights: ${intake.downlights} × install - provisional sum $${(intake.downlightProvisional as number ?? 0).toLocaleString()}`);
    } else {
      lines.push(`Downlights: ${intake.downlights} × supply & fit, ${gradeLabel}`);
    }
  }

  // Handle exhaust fans array
  const exhaustFans = intake.exhaustFans as {type: string; qty: number}[] | undefined;
  if (Array.isArray(exhaustFans) && exhaustFans.length > 0) {
    for (const ef of exhaustFans) {
      if (ef.qty > 0) {
        const typeLabel = ef.type === "ceiling" ? "ceiling-mounted" : ef.type === "ducted" ? "ducted" : "inline";
        lines.push(`Exhaust fans: ${ef.qty} × ${typeLabel}`);
      }
    }
  }

  // Handle cable runs array
  const cableRuns = intake.cableRuns as {size: string; metres: number}[] | undefined;
  if (Array.isArray(cableRuns) && cableRuns.length > 0) {
    for (const cr of cableRuns) {
      if (cr.metres > 0) {
        lines.push(`Cable ${cr.size}mm T&E: ${cr.metres}m`);
      }
    }
  }

  // Handle custom appliances array
  const customAppliances = intake.customAppliances as {label: string; phase: string; amps: number}[] | undefined;
  if (Array.isArray(customAppliances) && customAppliances.length > 0) {
    for (const ca of customAppliances) {
      if (ca.label) {
        lines.push(`${ca.label} circuit - ${ca.phase === "three" ? "3-phase" : "single phase"}, ${ca.amps}A`);
      }
    }
  }

  // All other fields using the humanizer labels
  for (const [key, value] of Object.entries(intake)) {
    if (SKIP.has(key)) continue;
    if (key === "switchboardUpgrade" || key === "downlights" || key === "exhaustFans" || key === "cableRuns" || key === "customAppliances") continue;
    if (value === null || value === undefined || value === "" || value === false) continue;
    if (typeof value === "number" && value === 0) continue;
    if (Array.isArray(value) || typeof value === "object") continue;

    const label = INTAKE_FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
    const valueLabels = INTAKE_VALUE_LABELS[key];
    const displayValue = valueLabels?.[String(value)] ?? String(value);

    lines.push(typeof value === "boolean" ? label : `${label}: ${displayValue}`);
  }

  // Site annotation items
  const siteItems = intake.site_items as {label:string;qty:number;unit:string;note:string}[] | undefined;
  if (Array.isArray(siteItems)) {
    for (const item of siteItems) {
      if (item.label) {
        lines.push(`${item.label}: ${item.qty} ${item.unit}`);
      }
    }
  }

  // COES always included
  lines.push("Certificate of Electrical Safety (COES) - included");

  return lines;
}
