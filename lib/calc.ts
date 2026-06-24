// Default material items seeded for a new electrician profile.
// These are placeholder costs only — every tradie overwrites them via
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
] as const;

export type MaterialCostMap = Record<string, number>;

export interface ElectricianIntake {
  jobType: "reno" | "newbuild" | "fault" | "compliance";
  switchboardUpgrade: boolean;
  switchboardRcbo: boolean;
  threePhase: boolean;
  powerPoints: number;
  lightPoints: number;
  switches: number;
  downlights: number;
  downlightGrade: "builder" | "standard" | "premium";
  roofAccess: 1 | 1.3 | 1.7 | 2.3;
  subfloorAccess: 1 | 1.3 | 1.8 | 2.4;
  trenchMetres: number;
  applianceOven: boolean;
  applianceCooktop: boolean;
  applianceHwc: boolean;
  applianceAircon: boolean;
  appliancePool: boolean;
  dataPoints: number;
  nbn: boolean;
  siteAccess: "easy" | "moderate" | "difficult";
  multistorey: boolean;
  smokeAlarms: number;
  coes: boolean;
  notes?: string;
}

export interface QuoteResult {
  labourHours: number;
  materialsCost: number; // including margin
  totalCost: number;
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

  wiringHours += intake.dataPoints * 0.5;
  materials += intake.dataPoints * (costs.data ?? 0);
  if (intake.nbn) {
    wiringHours += 0.5;
    materials += costs.nbn ?? 0;
  }

  wiringHours += intake.smokeAlarms * 1;
  materials += intake.smokeAlarms * (costs.smoke ?? 0);

  const accessFactor = intake.roofAccess * intake.subfloorAccess;
  const wiringHoursAdjusted = wiringHours * accessFactor;

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

  let siteAccessMult =
    intake.siteAccess === "easy" ? 1 : intake.siteAccess === "moderate" ? 1.15 : 1.35;
  if (intake.multistorey) siteAccessMult += 0.1;

  const totalHours = (wiringHoursAdjusted + trenchHours + otherHours) * siteAccessMult;
  const labourCost = totalHours * hourlyRate;
  const allMaterials = materials + trenchMaterials;
  const materialsWithMargin = allMaterials * (1 + marginPct / 100);
  const totalCost = labourCost + materialsWithMargin;

  return {
    labourHours: Math.round(totalHours * 10) / 10,
    materialsCost: Math.round(materialsWithMargin),
    totalCost: Math.round(totalCost),
  };
}
