/**
 * Build planner (structure_plans) helpers.
 *
 * The 3D planner lives in public/planner/build-planner.html and runs in an
 * iframe. On every change it posts back the full plan JSON plus a derived
 * `summary`: priced material lines (raw supplier cost, no margin) and labour
 * stages in crew hours. These helpers turn that summary into the two line
 * shapes the rest of the app already understands.
 */

export interface StructureLine {
  key: string;
  group: string;
  label: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

export interface StructureLabourStage {
  key: string;
  label: string;
  hours: number;
}

export interface StructureSummary {
  description?: string;
  width?: number;
  length?: number;
  height?: number;
  area?: number;
  materialsTotal?: number;
  labourHours?: number;
  labourRate?: number;
  unpriced?: number;
  lines?: StructureLine[];
  labour?: StructureLabourStage[];
}

/** Line shape the quote wizard takes as preMarkupMaterials (raw cost; the
 *  wizard applies the business margin once, uniformly). */
export interface WizardMarkupLine {
  label: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  labourHrs?: number;
}

/** Line shape stored on quotes.markup_materials (sell price, margin baked in,
 *  summed on top of quotes.total_cost everywhere it is read). */
export interface QuoteMarkupLine {
  label: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v: number) => Math.round(v * 100) / 100;

export function parseSummary(raw: unknown): StructureSummary {
  if (!raw || typeof raw !== "object") return {};
  const s = raw as Record<string, unknown>;
  const lines = Array.isArray(s.lines)
    ? (s.lines as Array<Record<string, unknown>>)
        .filter((l) => l && typeof l.label === "string" && l.label)
        .map((l) => ({
          key: String(l.key ?? ""),
          group: String(l.group ?? ""),
          label: String(l.label),
          quantity: num(l.quantity),
          unit: String(l.unit ?? "ea"),
          unitCost: num(l.unitCost),
          totalCost: num(l.totalCost),
        }))
    : [];
  const labour = Array.isArray(s.labour)
    ? (s.labour as Array<Record<string, unknown>>)
        .filter((l) => l && typeof l.label === "string")
        .map((l) => ({ key: String(l.key ?? ""), label: String(l.label), hours: Math.max(0, num(l.hours)) }))
    : [];
  return {
    description: typeof s.description === "string" ? s.description : undefined,
    width: num(s.width) || undefined,
    length: num(s.length) || undefined,
    height: num(s.height) || undefined,
    area: num(s.area) || undefined,
    materialsTotal: num(s.materialsTotal),
    labourHours: num(s.labourHours),
    labourRate: num(s.labourRate) || undefined,
    unpriced: num(s.unpriced),
    lines,
    labour,
  };
}

/** For /quote?structure_id=...: every material line (unpriced ones too, so
 *  the tradie sees what still needs a price) plus one labour line per stage. */
export function structureToWizardLines(summary: StructureSummary): WizardMarkupLine[] {
  const out: WizardMarkupLine[] = (summary.lines ?? [])
    .filter((l) => l.quantity > 0)
    .map((l) => ({
      label: l.label,
      quantity: l.quantity,
      unit: l.unit,
      unitCost: round2(l.unitCost),
      totalCost: round2(l.totalCost),
    }));
  for (const st of summary.labour ?? []) {
    if (st.hours <= 0) continue;
    out.push({ label: `Labour: ${st.label}`, quantity: st.hours, unit: "h", unitCost: 0, totalCost: 0, labourHrs: st.hours });
  }
  return out;
}

/** For adding a build to an existing quote's markup_materials. Margin is
 *  applied to materials here because markup_materials holds sell prices.
 *  Unpriced material lines are skipped (a $0 line on a sent quote is noise). */
export function structureToQuoteLines(
  summary: StructureSummary,
  marginPct: number,
  hourlyRate: number
): { lines: QuoteMarkupLine[]; skipped: number } {
  const m = 1 + Math.max(0, num(marginPct)) / 100;
  let skipped = 0;
  const lines: QuoteMarkupLine[] = [];
  for (const l of summary.lines ?? []) {
    if (!(l.quantity > 0)) continue;
    if (!(l.totalCost > 0)) {
      skipped++;
      continue;
    }
    lines.push({
      label: l.label,
      quantity: l.quantity,
      unit: l.unit,
      unitCost: round2(l.unitCost * m),
      totalCost: Math.round(l.totalCost * m),
    });
  }
  const rate = num(summary.labourRate) || num(hourlyRate);
  for (const st of summary.labour ?? []) {
    if (st.hours <= 0 || rate <= 0) continue;
    lines.push({ label: `Labour: ${st.label}`, quantity: st.hours, unit: "h", unitCost: round2(rate), totalCost: Math.round(st.hours * rate) });
  }
  return { lines, skipped };
}

/** Picks the trade a build should be quoted under from the business's trades. */
export function structureTrade(trades: string[] | null | undefined): string {
  const list = (trades ?? []).filter(Boolean);
  for (const t of ["carpenter", "builder", "concreter", "roofer"]) if (list.includes(t)) return t;
  return list[0] ?? "carpenter";
}
