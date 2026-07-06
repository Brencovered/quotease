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
    // -- Structured-intake calculator keys (calcElectricianQuote). Reuses
    // "data" and "smoke" above; adds the rest of the wizard's fields so
    // they can also be linked to real price-book products.
    { key: "pp",               label: "Power point",              keywords: ["power outlet", "powerpoint", "socket outlet", "gpo"] },
    { key: "lp",               label: "Light point",              keywords: ["light point", "batten holder", "ceiling rose"] },
    { key: "sw",               label: "Switch",                   keywords: ["gang switch", "switch 250v", "isolator switch"], exclude: ["switchboard", "switch plate", "cover plate"] },
    { key: "dl_builder",       label: "Downlight, builder grade", keywords: ["downlight"], exclude: ["frame", "trim", "flange", "adapter"] },
    { key: "dl_standard",      label: "Downlight, standard",      keywords: ["downlight"], exclude: ["frame", "trim", "flange", "adapter"] },
    { key: "dl_premium",       label: "Downlight, premium/smart", keywords: ["downlight", "smart"], exclude: ["frame", "trim", "flange", "adapter"] },
    { key: "dl_client_supply", label: "Downlight (wire & fit only)", keywords: ["downlight"], exclude: ["frame", "trim", "flange", "adapter"] },
    { key: "nbn",              label: "NBN connection point",     keywords: ["nbn"] },
    { key: "sb_rcd",           label: "Switchboard upgrade, RCD", keywords: ["switchboard", "rcd"], exclude: ["label", "lock", "filler"] },
    { key: "sb_rcbo_per_pole", label: "Switchboard RCBO per pole",keywords: ["rcbo"] },
    { key: "sb_rcbo_full",     label: "Switchboard, full RCBO",   keywords: ["switchboard", "rcbo"], exclude: ["label", "lock", "filler"] },
    { key: "three_phase",      label: "3-phase supply upgrade",   keywords: ["three phase", "3 phase", "3-phase"] },
    { key: "appliance",        label: "Fixed appliance circuit",  keywords: ["isolator", "appliance", "circuit"] },
    { key: "trench",           label: "Trenching (per m)",        keywords: ["trench", "conduit"] },
    { key: "cable_1_5",        label: "Cable 1.5mm (per m)",      keywords: ["1.5", "cable", "tps", "twin and earth"] },
    { key: "cable_2_5",        label: "Cable 2.5mm (per m)",      keywords: ["2.5", "cable", "tps", "twin and earth"] },
    { key: "cable_4",          label: "Cable 4mm (per m)",        keywords: ["4mm", "cable", "tps", "twin and earth"] },
    { key: "cable_6",          label: "Cable 6mm (per m)",        keywords: ["6mm", "cable", "tps", "twin and earth"] },
    { key: "cable_10",         label: "Cable 10mm (per m)",       keywords: ["10mm", "cable", "tps", "twin and earth"] },
    { key: "exhaust_ceiling",  label: "Exhaust fan, ceiling",     keywords: ["exhaust"] },
    { key: "exhaust_ducted",   label: "Exhaust fan, ducted",      keywords: ["exhaust", "ducted"] },
    { key: "exhaust_inline",   label: "Exhaust fan, inline",      keywords: ["exhaust", "inline"] },
    { key: "ev_charger",       label: "EV charger circuit",       keywords: ["ev charger", "electric vehicle"] },
    { key: "solar_connection", label: "Solar/battery connection", keywords: ["solar", "inverter", "battery"] },
    { key: "external_circuit", label: "External/outdoor circuit", keywords: ["outdoor", "weatherproof", "external"] },
    { key: "callout",          label: "Call-out / site survey fee", keywords: ["call-out", "callout", "survey fee"] },
    { key: "ccew",             label: "Certificate of Compliance",  keywords: ["certificate", "compliance", "ccew"] },
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
    // -- Structured-intake calculator keys (calcPlumberQuote). Separate
    // namespace from the AI-detection keys above so a tradie's per-fixture
    // job-detail form (not just AI drawing/voice) can also resolve real
    // price-book products instead of the built-in demo defaults.
    { key: "basin_tap",     label: "Basin mixer tap",       keywords: ["basin", "mixer", "tap"] },
    { key: "kitchen_tap",   label: "Kitchen mixer tap",     keywords: ["kitchen", "mixer", "tap"] },
    { key: "shower_mixer",  label: "Shower mixer",          keywords: ["shower", "mixer"] },
    { key: "bath_mixer",    label: "Bath mixer",            keywords: ["bath", "mixer"] },
    { key: "toilet_suite",  label: "Toilet suite",          keywords: ["toilet", "suite", "close coupled"] },
    { key: "cistern",       label: "Cistern",               keywords: ["cistern"] },
    { key: "hwu_electric",  label: "Hot water unit, electric", keywords: ["hot water", "electric"] },
    { key: "hwu_gas",       label: "Hot water unit, gas",   keywords: ["hot water", "gas"] },
    { key: "hwu_heatpump",  label: "Hot water unit, heat pump", keywords: ["hot water", "heat pump"] },
    { key: "wastepipe_m",   label: "Waste pipe (per m)",    keywords: ["waste", "pvc", "dwv"] },
    { key: "copper_m",      label: "Copper pipe (per m)",   keywords: ["copper"] },
    { key: "pex_m",         label: "PEX pipe (per m)",      keywords: ["pex"] },
    { key: "drainage_m",    label: "Drainage pipe (per m)", keywords: ["drainage", "sewer"] },
    { key: "flexi_hose",    label: "Flexi hose",            keywords: ["flexi", "hose"] },
    { key: "isolation_valve", label: "Isolation valve",     keywords: ["isolation", "valve"] },
    { key: "shower_base",   label: "Shower base",           keywords: ["shower", "base"] },
    { key: "shower_screen", label: "Shower screen",         keywords: ["shower", "screen"] },
    { key: "laundry_trough",label: "Laundry trough",        keywords: ["laundry", "trough"] },
    { key: "gas_point",     label: "Gas point / bayonet",   keywords: ["gas", "bayonet", "point"] },
    { key: "backflow_prev", label: "Backflow prevention",   keywords: ["backflow"] },
    { key: "callout",       label: "Call-out fee",          keywords: ["call-out", "callout", "survey fee"] },
    { key: "plumb_cert",    label: "Compliance certificate",keywords: ["certificate", "compliance", "cert"] },
  ],
  carpenter: [
    { key: "wall_frame", label: "Wall framing", keywords: ["framing", "stud", "timber"] },
    { key: "door",       label: "Door",         keywords: ["door"] },
    { key: "window",     label: "Window",       keywords: ["window"] },
    { key: "skirting",   label: "Skirting",     keywords: ["skirting"] },
    { key: "decking",    label: "Decking",      keywords: ["decking"] },
    // -- Structured-intake calculator keys (calcCarpenterQuote).
    { key: "framing_lm",     label: "Framing timber (per LM)", keywords: ["framing", "timber"] },
    { key: "sheet_ply",      label: "Structural ply sheet",    keywords: ["ply", "structural"] },
    { key: "sheet_mdf",      label: "MDF sheet",               keywords: ["mdf"] },
    { key: "door_internal",  label: "Internal door",           keywords: ["internal", "door"] },
    { key: "door_external",  label: "External door",           keywords: ["external", "door"] },
    { key: "door_hardware",  label: "Door hardware",           keywords: ["hardware", "handle", "hinge"] },
    { key: "skirting_lm",    label: "Skirting board (per LM)", keywords: ["skirting"] },
    { key: "architrave_lm",  label: "Architrave (per LM)",     keywords: ["architrave"] },
    { key: "decking_lm",     label: "Decking board (per LM)",  keywords: ["decking", "board"] },
    { key: "decking_bearer", label: "Decking bearer/joist",    keywords: ["bearer", "joist"] },
    { key: "stud_lm",        label: "Wall stud (per LM)",      keywords: ["stud"] },
    { key: "noggin_lm",      label: "Noggins/blocking",        keywords: ["noggin", "blocking"] },
    { key: "bath_frame",     label: "Bathroom frame pack",     keywords: ["bathroom", "frame", "pack"] },
    { key: "robe_shelf_lm",  label: "Robe shelf (per LM)",     keywords: ["robe", "shelf"] },
    { key: "fascia_lm",      label: "Fascia/barge (per LM)",   keywords: ["fascia", "barge"] },
    { key: "callout",        label: "Call-out / measure fee",  keywords: ["call-out", "callout", "measure fee"] },
    { key: "fixings",        label: "Fixings / adhesives",     keywords: ["fixing", "adhesive", "nail", "screw"] },
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
