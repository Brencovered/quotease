export const PLUMBER_DEFAULT_MATERIALS = [
  { item_key: "basin_tap",      label: "Basin mixer tap",              unit_cost: 85  },
  { item_key: "toilet_suite",   label: "Toilet suite (close coupled)", unit_cost: 220 },
  { item_key: "shower_mixer",   label: "Shower mixer",                 unit_cost: 120 },
  { item_key: "bath_mixer",     label: "Bath mixer",                   unit_cost: 150 },
  { item_key: "kitchen_tap",    label: "Kitchen mixer tap",            unit_cost: 95  },
  { item_key: "hwu_electric",   label: "Hot water unit, electric",     unit_cost: 650 },
  { item_key: "hwu_gas",        label: "Hot water unit, gas",          unit_cost: 850 },
  { item_key: "hwu_heatpump",   label: "Hot water unit, heat pump",    unit_cost: 1400},
  { item_key: "cistern",        label: "Cistern / close-coupled kit",  unit_cost: 95  },
  { item_key: "wastepipe_m",    label: "Waste pipe, per metre",        unit_cost: 12  },
  { item_key: "copper_m",       label: "Copper pipe, per metre",       unit_cost: 18  },
  { item_key: "pex_m",          label: "PEX pipe, per metre",          unit_cost: 8   },
  { item_key: "drainage_m",     label: "Drainage pipe, per metre",     unit_cost: 14  },
  { item_key: "flexi_hose",     label: "Flexi hose (pair)",            unit_cost: 18  },
  { item_key: "isolation_valve",label: "Isolation valve",              unit_cost: 22  },
  { item_key: "shower_base",    label: "Shower base",                  unit_cost: 180 },
  { item_key: "shower_screen",  label: "Shower screen",                unit_cost: 280 },
  { item_key: "laundry_trough", label: "Laundry trough + cabinet",     unit_cost: 210 },
  { item_key: "gas_point",      label: "Gas point / bayonet fitting",  unit_cost: 65  },
  { item_key: "backflow_prev",  label: "Backflow prevention device",   unit_cost: 95  },
  { item_key: "callout",        label: "Call-out / site survey fee",   unit_cost: 150 },
  { item_key: "plumb_cert",     label: "Compliance certificate",       unit_cost: 90  },
] as const;

export interface PlumberIntake {
  jobType: "na" | "reno" | "newbuild" | "fault" | "gasfitting" | "drainage" | "compliance";
  // Tapware
  basinTaps: number;
  kitchenTaps: number;
  showerMixers: number;
  bathMixers: number;
  toilets: number;
  // Hot water
  hwuReplacement: boolean;
  hwuType: "electric" | "gas" | "heatpump" | "none";
  // Rough-in / new
  newBathroomRoughin: boolean;
  newKitchenRoughin: boolean;
  newLaundryRoughin: boolean;
  // Gas
  gasPoints: number;
  gasCertRequired: boolean;
  // Pipework
  copperMetres: number;
  pexMetres: number;
  drainageMetres: number;
  // Drainage / sewer
  blockageClear: boolean;
  cctv: boolean;
  // Access
  subfloorAccess: "none" | "easy" | "tight" | "wet" | "custom";
  slabPenetrations: number;
  multistorey: boolean;
  // Compliance
  callout: boolean;
  certRequired: boolean;
  siteAccess: "na" | "easy" | "moderate" | "difficult" | "custom";
  notes?: string;
  subfloorAccessNote?: string;
  siteAccessNote?: string;
}

export interface PlumberQuoteResult {
  labourHours: number;
  materialsCost: number;
  totalCost: number;
}

export function calcPlumberQuote(
  intake: PlumberIntake,
  costs: Record<string, number>,
  hourlyRate: number,
  marginPct: number
): PlumberQuoteResult {
  let labour = 0;
  let materials = 0;

  // Tapware - 45 min each to replace, 1.5h new rough-in included below
  labour    += intake.basinTaps    * 0.75;
  materials += intake.basinTaps    * (costs.basin_tap    ?? 0);
  materials += intake.basinTaps    * (costs.flexi_hose   ?? 0);

  labour    += intake.kitchenTaps  * 0.75;
  materials += intake.kitchenTaps  * (costs.kitchen_tap  ?? 0);
  materials += intake.kitchenTaps  * (costs.flexi_hose   ?? 0);

  labour    += intake.showerMixers * 1;
  materials += intake.showerMixers * (costs.shower_mixer ?? 0);

  labour    += intake.bathMixers   * 1;
  materials += intake.bathMixers   * (costs.bath_mixer   ?? 0);

  labour    += intake.toilets      * 1;
  materials += intake.toilets      * (costs.toilet_suite ?? 0);
  materials += intake.toilets      * (costs.isolation_valve ?? 0);

  // Hot water
  if (intake.hwuReplacement && intake.hwuType !== "none") {
    labour += 3;
    const hwKey = intake.hwuType === "electric" ? "hwu_electric" : intake.hwuType === "gas" ? "hwu_gas" : "hwu_heatpump";
    materials += costs[hwKey] ?? 0;
  }

  // Rough-in (new bathrooms, kitchen, laundry - each is a half-day minimum)
  if (intake.newBathroomRoughin) { labour += 6; materials += (costs.copper_m ?? 0) * 8 + (costs.drainage_m ?? 0) * 6; }
  if (intake.newKitchenRoughin)  { labour += 4; materials += (costs.copper_m ?? 0) * 5 + (costs.drainage_m ?? 0) * 4; }
  if (intake.newLaundryRoughin)  { labour += 3; materials += (costs.pex_m    ?? 0) * 6 + (costs.drainage_m ?? 0) * 3; }

  // Gas
  labour    += intake.gasPoints * 1.5;
  materials += intake.gasPoints * (costs.gas_point ?? 0);
  if (intake.gasCertRequired) { labour += 0.5; materials += costs.backflow_prev ?? 0; }

  // Pipework
  materials += intake.copperMetres   * (costs.copper_m   ?? 0);
  materials += intake.pexMetres      * (costs.pex_m      ?? 0);
  materials += intake.drainageMetres * (costs.drainage_m ?? 0);
  labour    += (intake.copperMetres + intake.pexMetres + intake.drainageMetres) * 0.15;

  // Drainage work
  if (intake.blockageClear) { labour += 1.5; }
  if (intake.cctv)          { labour += 2;   }

  // Slab penetrations
  labour += intake.slabPenetrations * 2;

  // Access multipliers
  const subMult = { none: 1, easy: 1.2, tight: 1.5, wet: 1.8, custom: 1 }[intake.subfloorAccess];
  const siteMult = intake.siteAccess === "moderate" ? 1.15 : intake.siteAccess === "difficult" ? 1.35 : 1;
  const storey = intake.multistorey ? 1.1 : 1;

  const totalHours   = labour * subMult * siteMult * storey;
  const labourCost   = totalHours * hourlyRate;
  const calloutFee   = intake.callout ? (costs.callout ?? 0) : 0;
  const certFee      = intake.certRequired ? (costs.plumb_cert ?? 0) : 0;
  const matWithMargin = materials * (1 + marginPct / 100);
  const totalCost    = labourCost + matWithMargin + calloutFee + certFee;

  return {
    labourHours:   Math.round(totalHours * 10) / 10,
    materialsCost: Math.round(matWithMargin + calloutFee + certFee),
    totalCost:     Math.round(totalCost),
  };
}
