// Default material items seeded for a new electrician profile.
// These are placeholder costs only - every tradie overwrites them via
// the materials library screen or a CSV upload from their own supplier.
export const ELECTRICIAN_DEFAULT_MATERIALS = [
  { item_key: "pp", label: "Power point", unit_cost: 12 },
  { item_key: "lp", label: "Light point", unit_cost: 10 },
  { item_key: "sw", label: "Switch", unit_cost: 8 },
  { item_key: "dl_builder", label: "Downlight, builder grade", unit_cost: 18 },
  { item_key: "dl_standard", label: "Downlight, standard", unit_cost: 35 },
  { item_key: "dl_premium", label: "Downlight, premium / smart", unit_cost: 75 },
  { item_key: "data", label: "Data point", unit_cost: 15 },
  { item_key: "nbn", label: "NBN connection point", unit_cost: 20 },
  { item_key: "smoke", label: "Smoke alarm (interconnected)", unit_cost: 45 },
  { item_key: "sb_rcd", label: "Switchboard upgrade, RCD only", unit_cost: 380 },
  { item_key: "sb_rcbo", label: "Switchboard upgrade, full RCBO", unit_cost: 550 },
  { item_key: "three_phase", label: "3-phase supply upgrade", unit_cost: 250 },
  { item_key: "appliance", label: "Fixed appliance circuit (each)", unit_cost: 85 },
  { item_key: "trench", label: "Trenching, per metre", unit_cost: 22 },
  { item_key: "cable", label: "Cable, per metre (supply + install)", unit_cost: 8 },
  { item_key: "exhaust_fan", label: "Exhaust fan point", unit_cost: 25 },
  { item_key: "ev_charger", label: "EV charger circuit", unit_cost: 120 },
  { item_key: "solar_connection", label: "Solar/battery inverter connection", unit_cost: 150 },
  { item_key: "external_circuit", label: "External/outdoor circuit (each)", unit_cost: 45 },
  { item_key: "callout", label: "Call-out / site survey fee", unit_cost: 150 },
  { item_key: "ccew", label: "Certificate of Compliance (CCEW)", unit_cost: 120 },
] as const;

export type MaterialCostMap = Record<string, number>;

export interface ElectricianIntake {
  jobType: "reno" | "newbuild" | "fault" | "compliance";
  ceilingType: "standard_plasterboard" | "concrete_slab" | "heritage_timber" | "skillion" | "unknown";
  switchboardUpgrade: boolean;
  switchboardRcbo: boolean;
  threePhase: boolean;
  powerPoints: number;
  lightPoints: number;
  switches: number;
  downlights: number;
  downlightGrade: "builder" | "standard" | "premium";
  exhaustFans: number;
  cableMetres: number;
  roofAccess: 1 | 1.3 | 1.7 | 2.3;
  subfloorAccess: 1 | 1.3 | 1.8 | 2.4;
  trenchMetres: number;
  applianceOven: boolean;
  applianceCooktop: boolean;
  applianceHwc: boolean;
  applianceAircon: boolean;
  appliancePool: boolean;
  evCharger: boolean;
  solarConnection: boolean;
  externalCircuits: number;
  dataPoints: number;
  nbn: boolean;
  siteAccess: "easy" | "moderate" | "difficult";
  multistorey: boolean;
  smokeAlarms: number;
  coes: boolean;
  callout: boolean;
  ccew: boolean;
  notes?: string;
}

export interface QuoteResult {
  labourHours: number;
  materialsCost: number; // including margin
  totalCost: number;
}

// Ceiling type multiplier on wiring labour - heritage/slab installs take significantly longer
function ceilingMultiplier(t: ElectricianIntake["ceilingType"]): number {
  switch (t) {
    case "standard_plasterboard": return 1.0;
    case "skillion":              return 1.2;
    case "concrete_slab":         return 1.5;
    case "heritage_timber":       return 1.8;
    case "unknown":               return 1.1; // small buffer for uncertainty
  }
}

export function calcElectricianQuote(
  intake: ElectricianIntake,
  costs: MaterialCostMap,
  hourlyRate: number,
  marginPct: number
): QuoteResult {
  let wiringHours = 0;
  let materials = 0;

  wiringHours += intake.powerPoints * 0.4;
  materials += intake.powerPoints * (costs.pp ?? 0);

  wiringHours += intake.lightPoints * 0.5;
  materials += intake.lightPoints * (costs.lp ?? 0);

  wiringHours += intake.switches * 0.3;
  materials += intake.switches * (costs.sw ?? 0);

  wiringHours += intake.downlights * 0.4;
  const dlKey =
    intake.downlightGrade === "builder"
      ? "dl_builder"
      : intake.downlightGrade === "standard"
        ? "dl_standard"
        : "dl_premium";
  materials += intake.downlights * (costs[dlKey] ?? 0);

  wiringHours += intake.exhaustFans * 0.75;
  materials += intake.exhaustFans * (costs.exhaust_fan ?? 0);

  // Cable metres: material cost only (labour already captured in point counts above,
  // but extra cable on complex/heritage runs gets its own explicit line)
  materials += intake.cableMetres * (costs.cable ?? 0);

  wiringHours += intake.dataPoints * 0.5;
  materials += intake.dataPoints * (costs.data ?? 0);
  if (intake.nbn) {
    wiringHours += 0.5;
    materials += costs.nbn ?? 0;
  }

  wiringHours += intake.smokeAlarms * 1;
  materials += intake.smokeAlarms * (costs.smoke ?? 0);

  wiringHours += intake.externalCircuits * 1.5;
  materials += intake.externalCircuits * (costs.external_circuit ?? 0);

  // Apply ceiling type multiplier to all wiring hours before access factor
  const ceilMult = ceilingMultiplier(intake.ceilingType ?? "unknown");
  const wiringHoursCeiling = wiringHours * ceilMult;

  const accessFactor = intake.roofAccess * intake.subfloorAccess;
  const wiringHoursAdjusted = wiringHoursCeiling * accessFactor;

  const trenchHours = intake.trenchMetres * 0.35;
  const trenchMaterials = intake.trenchMetres * (costs.trench ?? 0);

  let otherHours = 0;
  if (intake.switchboardUpgrade) {
    otherHours += 4;
    materials += intake.switchboardRcbo ? costs.sb_rcbo ?? 0 : costs.sb_rcd ?? 0;
  }
  if (intake.threePhase) {
    otherHours += 2;
    materials += costs.three_phase ?? 0;
  }
  if (intake.evCharger) {
    otherHours += 3;
    materials += costs.ev_charger ?? 0;
  }
  if (intake.solarConnection) {
    otherHours += 2;
    materials += costs.solar_connection ?? 0;
  }
  const applianceCount = [
    intake.applianceOven,
    intake.applianceCooktop,
    intake.applianceHwc,
    intake.applianceAircon,
    intake.appliancePool,
  ].filter(Boolean).length;
  otherHours += applianceCount * 1.5;
  materials += applianceCount * (costs.appliance ?? 0);
  if (intake.coes) otherHours += 0.5;
  if (intake.ccew) {
    otherHours += 0.5;
    materials += costs.ccew ?? 0;
  }

  let siteAccessMult =
    intake.siteAccess === "easy" ? 1 : intake.siteAccess === "moderate" ? 1.15 : 1.35;
  if (intake.multistorey) siteAccessMult += 0.1;

  const totalHours = (wiringHoursAdjusted + trenchHours + otherHours) * siteAccessMult;
  const labourCost = totalHours * hourlyRate;

  // Callout is a flat fee, not subject to margin
  const calloutFee = intake.callout ? (costs.callout ?? 0) : 0;

  const allMaterials = materials + trenchMaterials;
  const materialsWithMargin = allMaterials * (1 + marginPct / 100);
  const totalCost = labourCost + materialsWithMargin + calloutFee;

  return {
    labourHours: Math.round(totalHours * 10) / 10,
    materialsCost: Math.round(materialsWithMargin + calloutFee),
    totalCost: Math.round(totalCost),
  };
}
