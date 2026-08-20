import type { QuoteLineItem } from "@/lib/calc";
import type { ScopeItem } from "@/components/ScopeOfWorkStep";

/** Map electrician calc line items into ScopeItem rows (raw materials, total labour hrs). */
export function quoteLineItemsToScopeItems(
  lines: QuoteLineItem[],
  note = "from estimate assistant"
): ScopeItem[] {
  return lines.map((l) => ({
    id: `est_${Math.random().toString(36).slice(2, 10)}`,
    label: l.label,
    qty: l.qty,
    unit: l.unit,
    note,
    materialsCost: Math.round(l.unitCost * l.qty),
    labourHrs: l.labour,
    source: "estimate" as const,
  }));
}

/**
 * Map aggregate calc results into 1-2 scope lines.
 * Pass materialsCost that is RAW (pre-margin) - call calcs with marginPct: 0.
 */
export function aggregateEstimateToScopeItems(
  result: { labourHours: number; materialsCost: number },
  opts: { labourLabel: string; materialsLabel: string; note?: string }
): ScopeItem[] {
  const note = opts.note ?? "from estimate assistant";
  const rows: ScopeItem[] = [];
  if (result.labourHours > 0) {
    rows.push({
      id: `est_${Math.random().toString(36).slice(2, 10)}`,
      label: opts.labourLabel,
      qty: result.labourHours,
      unit: "hr",
      note,
      materialsCost: 0,
      labourHrs: result.labourHours,
      source: "estimate",
    });
  }
  if (result.materialsCost > 0) {
    rows.push({
      id: `est_${Math.random().toString(36).slice(2, 10)}`,
      label: opts.materialsLabel,
      qty: 1,
      unit: "lot",
      note,
      materialsCost: Math.round(result.materialsCost),
      labourHrs: 0,
      source: "estimate",
    });
  }
  return rows;
}

export function costsFromMaterials(
  defaults: readonly { item_key: string; unit_cost: number }[],
  materials: { item_key: string; unit_cost: number }[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const d of defaults) map[d.item_key] = d.unit_cost;
  for (const m of materials) map[m.item_key] = m.unit_cost;
  return map;
}
