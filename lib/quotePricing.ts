/**
 * Shared quote-pricing helpers.
 *
 * Every trade builder needs to turn "site items" (from AI drawing analysis,
 * AI voice, or live annotations) and "markup materials" (from the plans
 * library takeoff/drawing-markup tool) into dollar totals the same way:
 *   - labour  = hours x the tradie's real hourly rate
 *   - materials = cost x (1 + effective margin%)
 *
 * Before this file existed each builder had its own inline reduce(), and
 * they'd drifted apart (margin applied in some, not others; Roofer using a
 * hardcoded $95/hr; Roofer dropping markup materials from totals entirely).
 * Route all trades through these so a fix here fixes everywhere.
 */

export interface SiteItem {
  qty?: number;
  quantity?: number;
  materialsCost: number;
  labourHrs: number;
}

export interface MarkupMaterial {
  label: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  /** Estimated install time for this takeoff line, hours. Optional -- older
      saved drafts / plans-library exports won't have this yet. */
  labourHrs?: number;
}

export function siteItemsLabourTotal(items: SiteItem[], rate: number): number {
  return items.reduce((s, i) => s + (i.labourHrs ?? 0) * rate, 0);
}

export function siteItemsLabourHours(items: SiteItem[]): number {
  return items.reduce((s, i) => s + (i.labourHrs ?? 0), 0);
}

export function siteItemsMaterialsTotal(items: SiteItem[], effectiveMarginPct: number): number {
  return items.reduce((s, i) => s + (i.materialsCost ?? 0) * (1 + effectiveMarginPct / 100), 0);
}

export function markupMaterialsTotal(items: MarkupMaterial[] | undefined, effectiveMarginPct: number): number {
  return (items ?? []).reduce((s, m) => s + (m.totalCost ?? 0) * (1 + effectiveMarginPct / 100), 0);
}

export function markupLabourTotal(items: MarkupMaterial[] | undefined, rate: number): number {
  return (items ?? []).reduce((s, m) => s + (m.labourHrs ?? 0) * rate, 0);
}

export function markupLabourHours(items: MarkupMaterial[] | undefined): number {
  return (items ?? []).reduce((s, m) => s + (m.labourHrs ?? 0), 0);
}

/** Combined charge-out total (labour + materials-at-margin) for a set of
    takeoff/markup materials -- the number that should actually be quoted. */
export function markupChargeTotal(items: MarkupMaterial[] | undefined, rate: number, effectiveMarginPct: number): number {
  return markupMaterialsTotal(items, effectiveMarginPct) + markupLabourTotal(items, rate);
}

/** Combined charge-out total (labour + materials-at-margin) for site items
    (AI drawing / AI voice / live annotation line items). */
export function siteItemsChargeTotal(items: SiteItem[], rate: number, effectiveMarginPct: number): number {
  return siteItemsLabourTotal(items, rate) + siteItemsMaterialsTotal(items, effectiveMarginPct);
}

/**
 * Converts package / plan-markup / material-bundle items into the same
 * ScopeItem shape used by the Scope step's "Materials & labour" list, so
 * they show up as itemized, editable/removable lines the tradie can
 * actually see and verify -- instead of being silently folded into a
 * single lump-sum total with no itemized display anywhere in the wizard.
 *
 * `totalCost` here must already be the RAW (pre-margin) cost -- the same
 * contract as every other ScopeItem.materialsCost, since the effective
 * margin gets applied once, uniformly, by siteItemsMaterialsTotal. Any
 * per-item margin baked in upstream (e.g. old plan-markup shapes) must be
 * stripped before calling this, or margin will be double-applied.
 */
export function markupMaterialsToScopeItems(
  items: MarkupMaterial[] | undefined,
  source: "package" | "plan markup" | "material bundle"
): Array<{ id: string; label: string; qty: number; unit: string; note: string; materialsCost: number; labourHrs: number; source: "package" | "plan_markup" | "material_bundle" }> {
  const structuredSource = source === "plan markup" ? "plan_markup" : source === "material bundle" ? "material_bundle" : "package";
  return (items ?? [])
    .filter((i) => i.label)
    .map((i) => ({
      id: `markup-${Math.random().toString(36).slice(2)}`,
      label: i.label,
      qty: i.quantity,
      unit: i.unit,
      note: `from ${source}`,
      materialsCost: i.totalCost ?? 0,
      labourHrs: i.labourHrs ?? 0,
      source: structuredSource as "package" | "plan_markup" | "material_bundle",
    }));
}
