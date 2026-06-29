// Shared human-readable label formatter for intake data fields.
// Used by both generateQuotePdf.ts and the public quote page /q/[token].

export const INTAKE_FIELD_LABELS: Record<string, string> = {
  switchboardUpgrade: "Switchboard upgrade",    switchboardRcbo: "RCBO upgrade",
  switchboardRcboMode: "RCBO type",              switchboardPoles: "Number of poles",
  threePhase: "3-phase supply",                 powerPoints: "Power points",
  lightPoints: "Light points",                  switches: "Switches",
  downlights: "Downlights",                     downlightGrade: "Fitting grade",
  exhaustFans: "Exhaust fans",                  downlightSupply: "Downlight supply",
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
  ceilingType:    { standard_plasterboard: "Standard plasterboard", concrete_slab: "Concrete slab", heritage_timber: "Heritage / period timber", skillion: "Skillion / cathedral", unknown: "Unknown - assess on site" },
  roofAccess:     { "1": "No roof work", "1.3": "Easy access", "1.7": "Tight crawl", "2.3": "Extreme" },
  subfloorAccess: { "1": "No subfloor work", "1.3": "Easy crawl", "1.8": "Tight crawl", "2.4": "Wet / very low" },
  siteAccess:     { easy: "Easy", moderate: "Moderate", difficult: "Difficult" },
  downlightGrade: { builder: "Builder grade", standard: "Standard", premium: "Premium / smart", client_supply: "Client supply" },
  downlightSupply: { supply_and_fit: "Supply & fit", wire_and_fit: "Wire & fit (client supply)", provisional: "Provisional sum" },
  switchboardRcboMode: { full_board: "Full RCBO board", per_pole: "RCBO per pole" },
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
  ceilingType:    new Set(["unknown"]),
  downlightSupply: new Set(["supply_and_fit"]), // supply_and_fit is default, only show if different
  switchboardRcboMode: new Set(["full_board"]),  // only show per_pole since full_board is obvious
};

export function humanizeIntakePublic(intake: Record<string, unknown> | null | undefined): string[] {
  if (!intake) return [];
  const lines: string[] = [];

  const SKIP = new Set([
    "notes", "jobType", "ceilingType",
    "roofAccess", "subfloorAccess", "siteAccess", "multistorey",
    "switchboardRcbo", "switchboardRcboMode", "switchboardPoles",
    "downlightGrade", "downlightSupply", "downlightProvisional",
  ]);

  // Switchboard as single composed line
  if (intake.switchboardUpgrade) {
    if (intake.switchboardRcbo) {
      if (intake.switchboardRcboMode === "per_pole") {
        lines.push(`Switchboard upgrade - RCBO per pole (${intake.switchboardPoles ?? 12} poles)`);
      } else {
        lines.push("Switchboard upgrade - full RCBO board");
      }
    } else {
      lines.push("Switchboard upgrade - RCD");
    }
  }

  // Downlights as single composed line
  if (typeof intake.downlights === "number" && intake.downlights > 0) {
    const supply = intake.downlightSupply as string;
    const grade  = intake.downlightGrade as string;
    const gradeLabel = grade === "builder" ? "builder grade" : grade === "standard" ? "standard" : grade === "premium" ? "premium" : "";
    if (supply === "wire_and_fit") {
      lines.push(`Downlights: ${intake.downlights} × wire & fit (client supply)`);
    } else if (supply === "provisional") {
      lines.push(`Downlights: ${intake.downlights} × install - provisional sum $${((intake.downlightProvisional as number) ?? 0).toLocaleString()}`);
    } else {
      lines.push(`Downlights: ${intake.downlights}${gradeLabel ? ` × supply & fit, ${gradeLabel}` : ""}`);
    }
  }

  // Exhaust fans array
  const exhaustFans = intake.exhaustFans as {type: string; qty: number}[] | undefined;
  if (Array.isArray(exhaustFans)) {
    for (const ef of exhaustFans) {
      if (ef.qty > 0) {
        const t = ef.type === "ceiling" ? "ceiling-mounted" : ef.type === "ducted" ? "ducted" : "inline";
        lines.push(`Exhaust fans: ${ef.qty} × ${t}`);
      }
    }
  }

  // Cable runs array
  const cableRuns = intake.cableRuns as {size: string; metres: number}[] | undefined;
  if (Array.isArray(cableRuns)) {
    for (const cr of cableRuns) {
      if (cr.metres > 0) lines.push(`Cable ${cr.size}mm T&E: ${cr.metres}m`);
    }
  }

  // Custom appliances array
  const customAppliances = intake.customAppliances as {label: string; phase: string; amps: number}[] | undefined;
  if (Array.isArray(customAppliances)) {
    for (const ca of customAppliances) {
      if (ca.label) lines.push(`${ca.label} circuit - ${ca.phase === "three" ? "3-phase" : "single phase"}, ${ca.amps}A`);
    }
  }

  // All other scalar fields
  for (const [key, value] of Object.entries(intake)) {
    if (SKIP.has(key)) continue;
    if (["switchboardUpgrade","downlights","exhaustFans","cableRuns","customAppliances"].includes(key)) continue;
    if (value === null || value === undefined || value === "" || value === false) continue;
    if (typeof value === "number" && value === 0) continue;
    if (Array.isArray(value) || typeof value === "object") continue;

    const suppressSet = SUPPRESS_VALUES[key];
    if (suppressSet?.has(String(value))) continue;

    const dep = DEPENDENT_FIELDS[key];
    if (dep) {
      const parentVal = intake[dep.parent];
      if (!parentVal || parentVal === false) continue;
      if (dep.nonZero && typeof parentVal === "number" && parentVal === 0) continue;
    }

    const label = INTAKE_FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
    if (typeof value === "boolean") { lines.push(label); continue; }
    const valueMap = INTAKE_VALUE_LABELS[key];
    if (valueMap?.[String(value)]) { lines.push(`${label}: ${valueMap[String(value)]}`); continue; }
    const unit = INTAKE_UNITS[key];
    lines.push(unit !== undefined ? `${label}: ${value}${unit}` : `${label}: ${value}`);
  }

  // Site annotation items
  const siteItems = intake.site_items as {label:string;qty:number;unit:string;note:string}[] | undefined;
  if (Array.isArray(siteItems)) {
    for (const item of siteItems) {
      if (item.label) {
        lines.push(`${item.label}: ${item.qty} ${item.unit}${item.note ? ` - ${item.note}` : ""}`);
      }
    }
  }

  // COES always included
  lines.push("Certificate of Electrical Safety (COES) - included");

  return lines;
}
