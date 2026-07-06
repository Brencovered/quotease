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
 * whether the tradie has mapped it to one or more real price-book products
 * (saved in profiles.archetype_defaults as "<trade>:calc:<key>" -> a JSON
 * array of item_keys, e.g. a "Power point" line might be a GPO + a cover
 * plate + an allowance for screws), sums their real costs, and uses that.
 * Otherwise it falls back to the trade's built-in default price so the
 * calculator never silently zeroes out.
 */

export interface CalcMaterialRow {
  item_key: string;
  label: string;
  unit_cost: number;
}

/** A calc-key link is stored as either a JSON array of item_keys (current
 *  format, supports multiple linked products) or a single bare item_key
 *  string (legacy format, from before multi-item linking existed). */
export function parseLinkedItemKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && x) : [];
    } catch {
      return [];
    }
  }
  return [raw];
}

export function serializeLinkedItemKeys(itemKeys: string[]): string {
  return JSON.stringify(itemKeys.filter(Boolean));
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

  // 3. Real price-book mapping: if the tradie has explicitly linked one or
  //    more real products to this calc key, their summed real cost wins
  //    over everything else.
  for (const key of Object.keys(costs)) {
    const linkedItemKeys = parseLinkedItemKeys(archetypeDefaults[`${trade}:calc:${key}`]);
    if (linkedItemKeys.length === 0) continue;
    let sum = 0;
    let matchedAny = false;
    for (const itemKey of linkedItemKeys) {
      const product = lib.find((r) => r.item_key === itemKey);
      if (!product) continue;
      const v = Number(product.unit_cost);
      if (isNaN(v)) continue;
      sum += v;
      matchedAny = true;
    }
    if (matchedAny) costs[key] = sum;
  }

  return costs;
}

/** Whether `lib` looks like a real uploaded price book (UUID-keyed) rather
 *  than the trade's generic-keyed defaults / legacy material_items rows. */
export function hasRealPriceBook(lib: CalcMaterialRow[]): boolean {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return lib.some((r) => uuidRe.test(r.item_key));
}

