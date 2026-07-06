/**
 * lib/resolveCalcCosts.ts
 * ------------------------
 * Structured-intake calculators (calcPlumberQuote, calcCarpenterQuote) price
 * jobs off a fixed set of generic keys (e.g. "basin_tap", "framing_lm").
 * Those keys only exist by default in the trade's built-in DEFAULT_MATERIALS
 * array -- they do NOT exist in a real supplier price book, which is keyed
 * by product id/SKU with real descriptions.
 *
 * This resolver bridges the two: for each generic calc key, it checks
 * whether the tradie has mapped it to a real price-book product (saved in
 * profiles.archetype_defaults as "<trade>:calc:<key>" -> item_key, set via
 * the price-book picker), and uses that product's real cost if so.
 * Otherwise it falls back to the trade's built-in default price so the
 * calculator never silently zeroes out.
 */

export interface CalcMaterialRow {
  item_key: string;
  label: string;
  unit_cost: number;
}

export function resolveCalcCosts(
  trade: string,
  defaults: readonly CalcMaterialRow[],
  lib: CalcMaterialRow[],
  archetypeDefaults: Record<string, string>
): Record<string, number> {
  const costs: Record<string, number> = {};

  // 1. Seed with the trade's built-in defaults so every key always has a
  //    sane fallback value even with no price book data at all.
  for (const d of defaults) costs[d.item_key] = d.unit_cost;

  // 2. Legacy path: a tradie who has directly edited a same-keyed row in
  //    Settings > Materials (material_items, no real price book uploaded
  //    yet) -- their edited value should win over the built-in default.
  for (const r of lib) {
    if (r.item_key in costs) {
      const v = Number(r.unit_cost);
      if (!isNaN(v)) costs[r.item_key] = v;
    }
  }

  // 3. Real price-book mapping: if the tradie has explicitly linked this
  //    calc key to a real product (via the price-book picker), that real
  //    cost wins over everything else.
  for (const key of Object.keys(costs)) {
    const linkedItemKey = archetypeDefaults[`${trade}:calc:${key}`];
    if (!linkedItemKey) continue;
    const product = lib.find((r) => r.item_key === linkedItemKey);
    if (product) {
      const v = Number(product.unit_cost);
      if (!isNaN(v)) costs[key] = v;
    }
  }

  return costs;
}

/** Whether `lib` looks like a real uploaded price book (UUID-keyed) rather
 *  than the trade's generic-keyed defaults / legacy material_items rows. */
export function hasRealPriceBook(lib: CalcMaterialRow[]): boolean {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return lib.some((r) => uuidRe.test(r.item_key));
}
