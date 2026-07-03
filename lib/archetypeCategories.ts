/**
 * lib/archetypeCategories.ts
 * --------------------------
 * Takeoff archetypes: the abstract things a tradie counts on a plan or that
 * AI drawing analysis detects ("downlight", "GPO", "cable run"). These are
 * deliberately generic -- counting should be fast on-site.
 *
 * Pricing, however, must come from the tradie's REAL price book. Each
 * archetype defines keyword filters that scope a searchable picker to the
 * relevant slice of the price book (e.g. "dl" -> descriptions containing
 * "downlight"). The tradie picks the actual product they install; the
 * choice is remembered in profiles.archetype_defaults keyed as
 * "<trade>:<archetype_key>" and auto-applied on future takeoffs.
 *
 * `exclude` keywords filter out accessory noise (e.g. trims/frames matching
 * "downlight") from the DEFAULT view -- the tradie can still find them via
 * search, which clears the exclusion.
 */

export interface ArchetypeCategory {
  key: string;
  label: string;
  keywords: string[];
  exclude?: string[];
}

export const ARCHETYPE_CATEGORIES: Record<string, ArchetypeCategory[]> = {
  electrician: [
    { key: "dl",      label: "Downlight",      keywords: ["downlight"], exclude: ["frame", "trim", "flange", "adapter"] },
    { key: "gpo",     label: "Power point",    keywords: ["power outlet", "powerpoint", "socket outlet", "gpo"] },
    { key: "switch",  label: "Switch",         keywords: ["gang switch", "switch 250v", "isolator switch", "sunset switch"], exclude: ["switchboard", "switch plate", "cover plate"] },
    { key: "data",    label: "Data point",     keywords: ["data", "cat6", "rj45", "nbn"] },
    { key: "exhaust", label: "Exhaust fan",    keywords: ["exhaust"] },
    { key: "smoke",   label: "Smoke alarm",    keywords: ["smoke alarm"], exclude: ["battery", "remote", "adapter"] },
    { key: "cable",   label: "Cable run",      keywords: ["twin and earth", "cable", "tps"], exclude: ["cable management", "usb", "suspension"] },
    { key: "conduit", label: "Conduit run",    keywords: ["conduit"] },
    { key: "sb",      label: "Switchboard",    keywords: ["switchboard"], exclude: ["label", "lock", "filler"] },
    { key: "circuit", label: "New circuit",    keywords: ["mcb", "rcbo", "rcd", "circuit breaker"] },
  ],
  plumber: [
    { key: "tap",        label: "Tap",         keywords: ["tap", "mixer"] },
    { key: "toilet",     label: "Toilet",      keywords: ["toilet", "cistern"] },
    { key: "basin",      label: "Basin",       keywords: ["basin", "vanity"] },
    { key: "shower",     label: "Shower",      keywords: ["shower"] },
    { key: "hwu",        label: "Hot water unit", keywords: ["hot water", "hwu"] },
    { key: "pipe_cold",  label: "Cold water pipe", keywords: ["pipe", "pex", "copper"] },
    { key: "pipe_hot",   label: "Hot water pipe",  keywords: ["pipe", "pex", "copper"] },
    { key: "pipe_waste", label: "Waste pipe",  keywords: ["waste", "pvc", "dwv"] },
  ],
  carpenter: [
    { key: "wall_frame", label: "Wall framing", keywords: ["framing", "stud", "timber"] },
    { key: "door",       label: "Door",         keywords: ["door"] },
    { key: "window",     label: "Window",       keywords: ["window"] },
    { key: "skirting",   label: "Skirting",     keywords: ["skirting"] },
    { key: "decking",    label: "Decking",      keywords: ["decking"] },
  ],
  roofer: [
    { key: "gutter",     label: "Guttering",   keywords: ["gutter"] },
    { key: "downpipe",   label: "Downpipe",    keywords: ["downpipe"] },
    { key: "ridge",      label: "Ridge",       keywords: ["ridge"] },
    { key: "valley",     label: "Valley",      keywords: ["valley"] },
    { key: "fascia",     label: "Fascia",      keywords: ["fascia"] },
    { key: "skylight",   label: "Skylight",    keywords: ["skylight"] },
    { key: "roof_area",  label: "Roof area",   keywords: ["colorbond", "roofing", "sheet", "tile"] },
  ],
};

/** Find the category definition for an archetype key within a trade
 *  (falls back to scanning all trades since detection output can cross over). */
export function findCategory(trade: string, archetypeKey: string): ArchetypeCategory | null {
  const inTrade = ARCHETYPE_CATEGORIES[trade]?.find((c) => c.key === archetypeKey);
  if (inTrade) return inTrade;
  for (const cats of Object.values(ARCHETYPE_CATEGORIES)) {
    const hit = cats.find((c) => c.key === archetypeKey);
    if (hit) return hit;
  }
  return null;
}

/** Filter a price book to the slice relevant to a category.
 *  When `search` is provided it takes over entirely (searches the whole
 *  book) so the tradie is never trapped by our keyword guesses. */
export function filterToCategory(
  lib: { item_key: string; label: string; unit_cost: number }[],
  category: ArchetypeCategory | null,
  search: string
): { item_key: string; label: string; unit_cost: number }[] {
  const q = search.trim().toLowerCase();
  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    return lib.filter((r) => {
      const hay = r.label.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  if (!category) return lib;
  return lib.filter((r) => {
    const hay = r.label.toLowerCase();
    if (!category.keywords.some((k) => hay.includes(k))) return false;
    if (category.exclude?.some((k) => hay.includes(k))) return false;
    return true;
  });
}
