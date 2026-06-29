export const ELECTRICIAN_DEFAULT_MATERIALS = [
  { item_key: "pp",               label: "Power point",                          unit_cost: 12 },
  { item_key: "lp",               label: "Light point",                          unit_cost: 10 },
  { item_key: "sw",               label: "Switch",                               unit_cost: 8 },
  { item_key: "dl_builder",       label: "Downlight, builder grade",             unit_cost: 18 },
  { item_key: "dl_standard",      label: "Downlight, standard",                  unit_cost: 35 },
  { item_key: "dl_premium",       label: "Downlight, premium / smart",           unit_cost: 75 },
  { item_key: "dl_client_supply", label: "Downlight, client supply (wire & fit)",unit_cost: 0  },
  { item_key: "data",             label: "Data point",                           unit_cost: 15 },
  { item_key: "nbn",              label: "NBN connection point",                 unit_cost: 20 },
  { item_key: "smoke",            label: "Smoke alarm (interconnected)",         unit_cost: 45 },
  { item_key: "sb_rcd",           label: "Switchboard upgrade, RCD only",        unit_cost: 380 },
  { item_key: "sb_rcbo_per_pole", label: "Switchboard upgrade, RCBO per pole",   unit_cost: 35 },
  { item_key: "sb_rcbo_full",     label: "Switchboard upgrade, full RCBO board", unit_cost: 550 },
  { item_key: "three_phase",      label: "3-phase supply upgrade",               unit_cost: 250 },
  { item_key: "appliance",        label: "Fixed appliance circuit (each)",       unit_cost: 85 },
  { item_key: "trench",           label: "Trenching, per metre",                 unit_cost: 22 },
  { item_key: "cable_1_5",        label: "Cable 1.5mm, per metre",               unit_cost: 4 },
  { item_key: "cable_2_5",        label: "Cable 2.5mm, per metre",               unit_cost: 6 },
  { item_key: "cable_4",          label: "Cable 4mm, per metre",                 unit_cost: 9 },
  { item_key: "cable_6",          label: "Cable 6mm, per metre",                 unit_cost: 13 },
  { item_key: "cable_10",         label: "Cable 10mm, per metre",                unit_cost: 20 },
  { item_key: "exhaust_ceiling",  label: "Exhaust fan, ceiling-mounted",         unit_cost: 35 },
  { item_key: "exhaust_ducted",   label: "Exhaust fan, ducted",                  unit_cost: 55 },
  { item_key: "exhaust_inline",   label: "Exhaust fan, inline",                  unit_cost: 85 },
  { item_key: "ev_charger",       label: "EV charger circuit",                   unit_cost: 120 },
  { item_key: "solar_connection", label: "Solar/battery inverter connection",    unit_cost: 150 },
  { item_key: "external_circuit", label: "External/outdoor circuit (each)",      unit_cost: 45 },
  { item_key: "callout",          label: "Call-out / site survey fee",           unit_cost: 150 },
  { item_key: "ccew",             label: "Certificate of Compliance (CCEW)",     unit_cost: 120 },
] as const;

export type MaterialCostMap = Record<string, number>;

// Cable run breakdown by size
export interface CableRun {
  size: "1.5" | "2.5" | "4" | "6" | "10";
  metres: number;
}

// Exhaust fan types
export type ExhaustFanType = "ceiling" | "ducted" | "inline";
export interface ExhaustFanEntry {
  type: ExhaustFanType;
  qty: number;
}

// Custom fixed appliance
export interface CustomAppliance {
  id:    string;
  label: string;
  phase: "single" | "three";
  amps:  number;
}

// Downlight supply type
export type DownlightSupply = "supply_and_fit" | "wire_and_fit" | "provisional";

export interface ElectricianIntake {
  jobType:           "reno" | "newbuild" | "fault" | "compliance";
  // ceiling type retained for calc engine but hidden from UI
  ceilingType:       "standard_plasterboard" | "concrete_slab" | "heritage_timber" | "skillion" | "unknown";
  switchboardUpgrade: boolean;
  switchboardRcbo:    boolean;
  switchboardRcboMode: "full_board" | "per_pole";
  switchboardPoles:   number;
  threePhase:         boolean;
  powerPoints:        number;
  lightPoints:        number;
  switches:           number;
  downlights:         number;
  downlightGrade:     "builder" | "standard" | "premium" | "client_supply";
  downlightSupply:    DownlightSupply;
  downlightProvisional: number; // provisional sum $ if supply = provisional
  exhaustFans:        ExhaustFanEntry[];
  cableRuns:          CableRun[];
  roofAccess:         1 | 1.3 | 1.7 | 2.3;
  subfloorAccess:     1 | 1.3 | 1.8 | 2.4;
  trenchMetres:       number;
  // Standard appliances
  applianceOven:      boolean;
  applianceCooktop:   boolean;
  applianceHwc:       boolean;
  applianceAircon:    boolean;
  appliancePool:      boolean;
  // Custom appliances
  customAppliances:   CustomAppliance[];
  evCharger:          boolean;
  solarConnection:    boolean;
  externalCircuits:   number;
  dataPoints:         number;
  nbn:                boolean;
  siteAccess:         "easy" | "moderate" | "difficult";
  multistorey:        boolean;
  smokeAlarms:        number;
  // COES always required -- removed from UI, always true in calc
  callout:            boolean;
  ccew:               boolean;
  notes?:             string;
}

export interface QuoteResult {
  labourHours:   number;
  materialsCost: number;
  totalCost:     number;
  lineItems:     QuoteLineItem[];
}

export interface QuoteLineItem {
  label:    string;
  qty:      number;
  unit:     string;
  unitCost: number;
  labour:   number; // hours
  total:    number;
}

function ceilingMultiplier(t: ElectricianIntake["ceilingType"]): number {
  switch (t) {
    case "standard_plasterboard": return 1.0;
    case "skillion":              return 1.2;
    case "concrete_slab":         return 1.5;
    case "heritage_timber":       return 1.8;
    case "unknown":               return 1.1;
  }
}

export function calcElectricianQuote(
  intake: ElectricianIntake,
  costs: MaterialCostMap,
  hourlyRate: number,
  marginPct: number
): QuoteResult {
  const lines: QuoteLineItem[] = [];
  const margin = 1 + marginPct / 100;
  const ceilMult = ceilingMultiplier(intake.ceilingType ?? "unknown");
  const accessFactor = (intake.roofAccess ?? 1) * (intake.subfloorAccess ?? 1);
  const siteAccessMult =
    intake.siteAccess === "easy" ? 1 : intake.siteAccess === "moderate" ? 1.15 : 1.35;
  const storeysAdd = intake.multistorey ? 0.1 : 0;
  const overallAccess = (accessFactor * ceilMult) * (siteAccessMult + storeysAdd);

  function addLine(label: string, qty: number, unit: string, labourPerUnit: number, matKey: string, unitCost?: number) {
    if (qty <= 0) return;
    const uc   = unitCost ?? costs[matKey] ?? 0;
    const mat  = uc * qty * margin;
    const hrs  = labourPerUnit * qty * overallAccess;
    const labour = hrs * hourlyRate;
    lines.push({ label, qty, unit, unitCost: uc, labour: hrs, total: Math.round(mat + labour) });
  }

  // Points
  addLine("Supply & install power point",    intake.powerPoints, "each", 0.4, "pp");
  addLine("Supply & install light point",    intake.lightPoints, "each", 0.5, "lp");
  addLine("Supply & install switch",         intake.switches,    "each", 0.3, "sw");

  // Downlights -- three supply modes
  if (intake.downlights > 0) {
    const supply = intake.downlightSupply ?? "supply_and_fit";
    if (supply === "wire_and_fit") {
      addLine("Wire & fit downlight (client supply)", intake.downlights, "each", 0.4, "dl_client_supply", 0);
    } else if (supply === "provisional") {
      const provSum = intake.downlightProvisional ?? 0;
      const hrs = 0.4 * intake.downlights * overallAccess;
      lines.push({
        label:    `Downlight install - provisional sum for supply ($${provSum.toLocaleString()})`,
        qty:      intake.downlights,
        unit:     "each",
        unitCost: provSum / Math.max(intake.downlights, 1),
        labour:   hrs,
        total:    Math.round(provSum + hrs * hourlyRate),
      });
    } else {
      const dlKey = intake.downlightGrade === "builder" ? "dl_builder"
        : intake.downlightGrade === "standard"  ? "dl_standard"
        : intake.downlightGrade === "premium"   ? "dl_premium"
        : "dl_builder";
      const gradeLabel = intake.downlightGrade === "client_supply" ? "client supply" : intake.downlightGrade;
      addLine(`Supply & fit downlight (${gradeLabel})`, intake.downlights, "each", 0.4, dlKey);
    }
  }

  // Exhaust fans by type
  for (const ef of intake.exhaustFans ?? []) {
    if (ef.qty <= 0) continue;
    const key   = ef.type === "ceiling" ? "exhaust_ceiling" : ef.type === "ducted" ? "exhaust_ducted" : "exhaust_inline";
    const label = ef.type === "ceiling" ? "Supply & install exhaust fan (ceiling)"
      : ef.type === "ducted" ? "Supply & install exhaust fan (ducted)"
      : "Supply & install exhaust fan (inline)";
    addLine(label, ef.qty, "each", 0.75, key);
  }

  // Cable by size
  for (const run of intake.cableRuns ?? []) {
    if (run.metres <= 0) continue;
    const key   = `cable_${run.size.replace(".", "_")}`;
    addLine(`Supply & install cable ${run.size}mm T&E`, run.metres, "m", 0, key);
  }

  // Data & NBN
  addLine("Supply & install data point", intake.dataPoints, "each", 0.5, "data");
  if (intake.nbn) addLine("NBN connection point", 1, "each", 0.5, "nbn");

  // Smoke alarms
  addLine("Supply & install smoke alarm (interconnected)", intake.smokeAlarms, "each", 1.0, "smoke");

  // External circuits
  addLine("External/outdoor circuit", intake.externalCircuits, "each", 1.5, "external_circuit");

  // Switchboard
  if (intake.switchboardUpgrade) {
    if (intake.switchboardRcbo) {
      if (intake.switchboardRcboMode === "per_pole") {
        const poles = intake.switchboardPoles ?? 12;
        const hrs = (4 + poles * 0.2) / overallAccess; // unaffected by ceiling for SB work
        const uc  = costs.sb_rcbo_per_pole ?? 35;
        lines.push({
          label:    `Switchboard upgrade - RCBO per pole (${poles} poles)`,
          qty:      poles, unit: "pole", unitCost: uc,
          labour:   Math.round(hrs * 10) / 10,
          total:    Math.round(uc * poles * margin + hrs * hourlyRate),
        });
      } else {
        addLine("Switchboard upgrade - full RCBO board", 1, "each", 4, "sb_rcbo_full");
      }
    } else {
      addLine("Switchboard upgrade - RCD", 1, "each", 4, "sb_rcd");
    }
  }

  // 3-phase
  if (intake.threePhase) addLine("3-phase supply upgrade", 1, "each", 2, "three_phase");

  // EV + solar
  if (intake.evCharger)      addLine("EV charger circuit", 1, "each", 3, "ev_charger");
  if (intake.solarConnection) addLine("Solar/battery inverter connection", 1, "each", 2, "solar_connection");

  // Standard appliances
  const stdAppliances: [boolean, string][] = [
    [intake.applianceOven,     "Oven circuit"],
    [intake.applianceCooktop,  "Cooktop circuit"],
    [intake.applianceHwc,      "Hot water circuit"],
    [intake.applianceAircon,   "Aircon circuit"],
    [intake.appliancePool,     "Pool/spa circuit"],
  ];
  for (const [enabled, label] of stdAppliances) {
    if (enabled) addLine(`${label} - supply & wire`, 1, "each", 1.5, "appliance");
  }

  // Custom appliances
  for (const ca of intake.customAppliances ?? []) {
    const phaseLabel = ca.phase === "three" ? "3-phase" : "single phase";
    addLine(
      `${ca.label} circuit - ${phaseLabel}, ${ca.amps}A`,
      1, "each",
      ca.phase === "three" ? 2.5 : 1.5,
      "appliance"
    );
  }

  // Trenching
  if (intake.trenchMetres > 0) {
    const hrs = intake.trenchMetres * 0.35;
    const uc  = costs.trench ?? 22;
    lines.push({
      label:    "Trenching",
      qty:      intake.trenchMetres, unit: "m", unitCost: uc,
      labour:   hrs,
      total:    Math.round(uc * intake.trenchMetres * margin + hrs * hourlyRate),
    });
  }

  // COES -- always included, not shown as a checkbox
  const coesHrs = 0.5;
  lines.push({ label: "Certificate of Electrical Safety (COES)", qty: 1, unit: "each", unitCost: 0, labour: coesHrs, total: Math.round(coesHrs * hourlyRate) });

  // CCEW
  if (intake.ccew) addLine("Certificate of Compliance (CCEW)", 1, "each", 0.5, "ccew");

  // Callout (flat fee, no margin)
  if (intake.callout) {
    const uc = costs.callout ?? 150;
    lines.push({ label: "Call-out / site survey fee", qty: 1, unit: "each", unitCost: uc, labour: 0, total: uc });
  }

  const totalLabourHours   = lines.reduce((s, l) => s + l.labour, 0);
  const totalMaterialsCost = lines.reduce((s, l) => s + Math.round((l.unitCost * l.qty) * margin), 0);
  const totalCost          = lines.reduce((s, l) => s + l.total, 0);

  return {
    labourHours:   Math.round(totalLabourHours * 10) / 10,
    materialsCost: totalMaterialsCost,
    totalCost:     Math.round(totalCost),
    lineItems:     lines,
  };
}
