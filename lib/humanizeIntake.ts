// Shared human-readable label formatter for intake data fields.
// Used by both generateQuotePdf.ts and the public quote page /q/[token].

export const INTAKE_FIELD_LABELS: Record<string, string> = {
  switchboardUpgrade: "Switchboard upgrade",    switchboardRcbo: "Full RCBO upgrade",
  threePhase: "3-phase supply",                 powerPoints: "Power points",
  lightPoints: "Light points",                  switches: "Switches",
  downlights: "Downlights",                     downlightGrade: "Fitting grade",
  exhaustFans: "Exhaust fans",                  cableMetres: "Cable run",
  trenchMetres: "Trenching",                    roofAccess: "Roof access",
  subfloorAccess: "Subfloor access",            ceilingType: "Ceiling type",
  siteAccess: "Site access",                    multistorey: "Multi-storey",
  smokeAlarms: "Smoke alarms",                  coes: "Certificate of Electrical Safety (COES)",
  ccew: "Certificate of Compliance (CCEW)",     callout: "Call-out fee",
  dataPoints: "Data points",                    nbn: "NBN connection point",
  externalCircuits: "External circuits",        applianceOven: "Oven circuit",
  applianceCooktop: "Cooktop circuit",          applianceHwc: "Hot water circuit",
  applianceAircon: "Aircon circuit",            appliancePool: "Pool / spa circuit",
  evCharger: "EV charger circuit",              solarConnection: "Solar / battery connection",
  basinTaps: "Basin taps",                      kitchenTaps: "Kitchen taps",
  showerMixers: "Shower mixers",                bathMixers: "Bath mixers",
  toilets: "Toilets",                           hwuReplacement: "Hot water unit replacement",
  hwuType: "Hot water unit type",               newBathroomRoughin: "New bathroom rough-in",
  newKitchenRoughin: "New kitchen rough-in",    newLaundryRoughin: "New laundry rough-in",
  gasPoints: "Gas points",                      gasCertRequired: "Gas compliance cert",
  copperMetres: "Copper pipe",                  pexMetres: "PEX pipe",
  drainageMetres: "Drainage pipe",              blockageClear: "Drain blockage clear",
  cctv: "CCTV drain inspection",                slabPenetrations: "Slab penetrations",
  certRequired: "Compliance certificate",       internalDoors: "Internal doors",
  externalDoors: "External doors",              doorFramesOnly: "Door frames (no door)",
  skirtingMetres: "Skirting board",             architraveMetres: "Architrave",
  newWallFrames: "New stud walls",              framingTimberLm: "Framing timber",
  plywoodSheets: "Plywood sheets",              deckingSqm: "Decking area",
  deckingBeamLm: "Decking bearers",             robeShelvingLm: "Robe shelving",
  fasciaLm: "Fascia / barge",                   workingAtHeight: "Working at height",
  roofSqm: "Roof area",                         roofPitch: "Roof pitch",
  ridgeLm: "Ridge capping",                     valleyLm: "Valley iron",
  gutterLm: "Gutters",                          downpipeLm: "Downpipes",
  whirlybirds: "Whirlybirds",                   skylights: "Skylights",
  insulationSqm: "Roof insulation",             flashingLm: "Flashing",
  scaffoldDays: "Scaffold days",                twoStorey: "Two-storey",
};

export const INTAKE_VALUE_LABELS: Record<string, Record<string, string>> = {
  ceilingType:    { standard_plasterboard: "Standard plasterboard", concrete_slab: "Concrete slab", heritage_timber: "Heritage / period timber", skillion: "Skillion / cathedral", unknown: "Unknown — assess on site" },
  roofAccess:     { "1": "No roof work", "1.3": "Easy access", "1.7": "Tight crawl", "2.3": "Extreme" },
  subfloorAccess: { "1": "No subfloor work", "1.3": "Easy crawl", "1.8": "Tight crawl", "2.4": "Wet / very low" },
  siteAccess:     { easy: "Easy", moderate: "Moderate", difficult: "Difficult" },
  downlightGrade: { builder: "Builder grade", standard: "Standard", premium: "Premium / smart" },
  roofType:       { colorbond: "Colorbond / metal", terracotta: "Terracotta tile", concrete_tile: "Concrete tile", mixed: "Mixed" },
  roofPitch:      { low: "Low pitch (<15°)", standard: "Standard (15–30°)", steep: "Steep (>30°)" },
  hwuType:        { electric: "Electric", gas: "Gas", heatpump: "Heat pump" },
};

export const INTAKE_UNITS: Record<string, string> = {
  cableMetres: "m", trenchMetres: "m", copperMetres: "m", pexMetres: "m",
  drainageMetres: "m", skirtingMetres: "m", architraveMetres: "m",
  fasciaLm: "m", framingTimberLm: "m", deckingBeamLm: "m", ridgeLm: "m",
  valleyLm: "m", gutterLm: "m", downpipeLm: "m", flashingLm: "m",
  robeShelvingLm: "m", deckingSqm: " sqm", roofSqm: " sqm", insulationSqm: " sqm",
  scaffoldDays: " days", newWallFrames: " walls", plywoodSheets: " sheets",
};

// Fields that are dependent on other fields being non-zero
// e.g. downlightGrade only shows if downlights > 0
const DEPENDENT_FIELDS: Record<string, { parent: string; nonZero?: boolean }> = {
  downlightGrade: { parent: "downlights", nonZero: true },
  hwuType:        { parent: "hwuReplacement" },
  roofType:       { parent: "roofSqm", nonZero: true },
};

// Values that mean "nothing selected / default" and should be suppressed
const SUPPRESS_VALUES: Record<string, Set<string>> = {
  roofAccess:     new Set(["1"]),    // "No roof work"
  subfloorAccess: new Set(["1"]),    // "No subfloor work"
  siteAccess:     new Set(["easy"]), // easy is the default, only show if moderate/difficult
  ceilingType:    new Set(["unknown"]), // unknown = not assessed, don't show
};

export function humanizeIntakePublic(intake: Record<string, unknown> | null | undefined): string[] {
  if (!intake) return [];
  const SKIP = new Set(["notes", "jobType"]);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(intake)) {
    if (SKIP.has(key)) continue;
    if (value === null || value === undefined || value === "" || value === false) continue;
    if (typeof value === "number" && value === 0) continue;
    if (Array.isArray(value) || typeof value === "object") continue;

    // Suppress default/no-op values
    const suppressSet = SUPPRESS_VALUES[key];
    if (suppressSet?.has(String(value))) continue;

    // Suppress dependent fields when parent is falsy/zero
    const dep = DEPENDENT_FIELDS[key];
    if (dep) {
      const parentVal = intake[dep.parent];
      if (!parentVal || parentVal === false) continue;
      if (dep.nonZero && (typeof parentVal === "number" && parentVal === 0)) continue;
    }

    const label = INTAKE_FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
    if (typeof value === "boolean") { lines.push(label); continue; }
    const valueMap = INTAKE_VALUE_LABELS[key];
    if (valueMap?.[String(value)]) { lines.push(`${label}: ${valueMap[String(value)]}`); continue; }
    const unit = INTAKE_UNITS[key];
    if (unit !== undefined) { lines.push(`${label}: ${value}${unit}`); continue; }
    lines.push(`${label}: ${value}`);
  }
  return lines;
}
