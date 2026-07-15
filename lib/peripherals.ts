/**
 * Trade-specific site peripherals (PRD: "Trade-Specific Site Peripherals").
 *
 * Deliberately a static per-trade reference list in code, not a DB table.
 * Unlike price-book items (genuinely variable per business/supplier),
 * these are close to industry-standard checkboxes - the same "Scaffolding"
 * or "Roof access" line applies however a tradie prices it, and the
 * amount is fully editable per-quote once toggled on (it becomes a normal
 * ScopeItem, using the same editable qty/unit-cost row every other line
 * uses). A per-business "set my own default rate for this" customisation
 * is a reasonable future iteration, but isn't needed to ship the core
 * value: toggle it on, get an editable line, never dig for it manually.
 */

export type PeripheralKind = "fixed" | "daily";

export interface PeripheralTemplate {
  key: string;
  label: string;
  kind: PeripheralKind;
  /** Starting amount - fixed fee in dollars, or dollars per day for a
   *  daily-rate peripheral. Always editable once toggled on. */
  defaultAmount: number;
}

export const PERIPHERALS_BY_TRADE: Record<string, PeripheralTemplate[]> = {
  electrician: [
    { key: "level2_connection", label: "Level 2 connection fees", kind: "fixed", defaultAmount: 350 },
    { key: "switchboard_isolation", label: "Main switchboard isolation", kind: "fixed", defaultAmount: 120 },
  ],
  plumber: [
    { key: "excavator_hire", label: "Excavator hire", kind: "daily", defaultAmount: 450 },
    { key: "confined_space", label: "Confined space access", kind: "fixed", defaultAmount: 200 },
    { key: "asbestos_mgmt", label: "Asbestos management", kind: "fixed", defaultAmount: 350 },
  ],
  roofer: [
    { key: "roof_access", label: "Roof access", kind: "fixed", defaultAmount: 150 },
    { key: "edge_protection", label: "Edge protection", kind: "fixed", defaultAmount: 250 },
    { key: "scaffolding", label: "Scaffolding", kind: "daily", defaultAmount: 180 },
    { key: "high_works", label: "High works", kind: "daily", defaultAmount: 220 },
  ],
  carpenter: [
    { key: "working_at_height", label: "Working at height", kind: "daily", defaultAmount: 150 },
    { key: "scaffolding", label: "Scaffolding", kind: "daily", defaultAmount: 180 },
    { key: "waste_removal", label: "Waste removal", kind: "fixed", defaultAmount: 180 },
  ],
  default: [
    { key: "site_access", label: "Site access fee", kind: "fixed", defaultAmount: 100 },
    { key: "waste_removal", label: "Waste removal", kind: "fixed", defaultAmount: 180 },
  ],
};

export function peripheralsForTrade(trade: string): PeripheralTemplate[] {
  return PERIPHERALS_BY_TRADE[trade] ?? PERIPHERALS_BY_TRADE.default;
}

/**
 * Business-aware version of peripheralsForTrade. The static list above is
 * now only a one-time seed source, not the source of truth: the first
 * time a business needs peripherals for a given trade with no
 * site_condition_templates rows yet, this seeds real DB rows from the
 * hardcoded defaults, then returns from the DB every time after - fully
 * editable per business per trade from Settings, nothing hard-set past
 * that first seed.
 */
export interface SiteConditionTemplateRow {
  id: string; trade: string; label: string; kind: PeripheralKind; default_amount: number; sort_order: number;
}

export async function getPeripheralsForBusiness(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  businessId: string,
  trade: string
): Promise<SiteConditionTemplateRow[]> {
  const { data: existing } = await supabase
    .from("site_condition_templates")
    .select("id, trade, label, kind, default_amount, sort_order")
    .eq("profile_id", businessId)
    .eq("trade", trade)
    .order("sort_order");

  if (existing && existing.length > 0) return existing;

  const seed = peripheralsForTrade(trade);
  if (seed.length === 0) return [];

  const { data: inserted } = await supabase
    .from("site_condition_templates")
    .insert(seed.map((s, i) => ({
      profile_id: businessId, trade, label: s.label, kind: s.kind, default_amount: s.defaultAmount, sort_order: i,
    })))
    .select("id, trade, label, kind, default_amount, sort_order");

  return inserted ?? [];
}
