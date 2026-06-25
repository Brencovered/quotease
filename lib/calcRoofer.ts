export const ROOFER_DEFAULT_MATERIALS = [
  { item_key: "colorbond_sqm",  label: "Colorbond roofing, per sqm",    unit_cost: 28  },
  { item_key: "terracotta_sqm", label: "Terracotta tile, per sqm",       unit_cost: 45  },
  { item_key: "concrete_tile",  label: "Concrete tile, per sqm",         unit_cost: 32  },
  { item_key: "sarking_sqm",    label: "Sarking / roof underlay, per sqm",unit_cost: 6   },
  { item_key: "ridge_lm",       label: "Ridge capping, per LM",          unit_cost: 22  },
  { item_key: "valley_lm",      label: "Valley iron / flashing, per LM", unit_cost: 18  },
  { item_key: "fascia_lm",      label: "Fascia board, per LM",           unit_cost: 14  },
  { item_key: "gutter_lm",      label: "Gutter (quad/half-round), per LM",unit_cost: 16  },
  { item_key: "downpipe_lm",    label: "Downpipe, per LM",               unit_cost: 12  },
  { item_key: "whirlybird",     label: "Whirlybird ventilator",           unit_cost: 95  },
  { item_key: "skylight",       label: "Skylight (fixed, 900×600)",       unit_cost: 480 },
  { item_key: "roof_insul_sqm", label: "Roof insulation batts, per sqm",  unit_cost: 12  },
  { item_key: "flex_flashing",  label: "Flashing (metre roll)",           unit_cost: 35  },
  { item_key: "screws_box",     label: "Roofing screws (box)",            unit_cost: 25  },
  { item_key: "callout",        label: "Call-out / roof inspection fee",  unit_cost: 180 },
  { item_key: "scaffold_day",   label: "Scaffolding hire, per day",       unit_cost: 280 },
] as const;

export interface RooferIntake {
  jobType: "reroof" | "repair" | "new" | "gutters" | "inspection";
  roofType: "colorbond" | "terracotta" | "concrete_tile" | "mixed";
  // Area
  roofSqm: number;
  roofPitch: "low" | "standard" | "steep"; // affects labour multiplier
  // Replacement items
  ridgeLm: number;
  valleyLm: number;
  fasciaLm: number;
  gutterLm: number;
  downpipeLm: number;
  // Extras
  whirlybirds: number;
  skylights: number;
  insulationSqm: number;
  flashingLm: number;
  // Access
  scaffoldDays: number;
  twoStorey: boolean;
  siteAccess: "easy" | "moderate" | "difficult";
  // Compliance
  callout: boolean;
  notes?: string;
}

export interface RooferQuoteResult {
  labourHours: number;
  materialsCost: number;
  totalCost: number;
}

export function calcRooferQuote(
  intake: RooferIntake,
  costs: Record<string, number>,
  hourlyRate: number,
  marginPct: number
): RooferQuoteResult {
  let labour = 0;
  let materials = 0;

  // Base roof area labour: 0.25h per sqm low pitch, 0.35h standard, 0.5h steep
  const pitchLabourRate = { low: 0.25, standard: 0.35, steep: 0.5 }[intake.roofPitch];
  labour += intake.roofSqm * pitchLabourRate;

  // Roof sheeting material
  const matKey = intake.roofType === "colorbond" ? "colorbond_sqm" : intake.roofType === "terracotta" ? "terracotta_sqm" : "concrete_tile";
  materials += intake.roofSqm * (costs[matKey] ?? 0);
  materials += intake.roofSqm * (costs.sarking_sqm ?? 0);
  materials += intake.roofSqm * 0.02 * (costs.screws_box ?? 0); // 2% area in screw boxes

  // Linear items
  labour    += intake.ridgeLm    * 0.25;
  materials += intake.ridgeLm    * (costs.ridge_lm  ?? 0);

  labour    += intake.valleyLm   * 0.3;
  materials += intake.valleyLm   * (costs.valley_lm ?? 0);

  labour    += intake.fasciaLm   * 0.2;
  materials += intake.fasciaLm   * (costs.fascia_lm ?? 0);

  labour    += intake.gutterLm   * 0.2;
  materials += intake.gutterLm   * (costs.gutter_lm ?? 0);

  labour    += intake.downpipeLm * 0.25;
  materials += intake.downpipeLm * (costs.downpipe_lm ?? 0);

  // Extras
  labour    += intake.whirlybirds * 1;
  materials += intake.whirlybirds * (costs.whirlybird ?? 0);

  labour    += intake.skylights   * 4;
  materials += intake.skylights   * (costs.skylight   ?? 0);

  materials += intake.insulationSqm * (costs.roof_insul_sqm ?? 0);
  labour    += intake.insulationSqm * 0.1;

  materials += intake.flashingLm * (costs.flex_flashing ?? 0);
  labour    += intake.flashingLm * 0.15;

  // Scaffolding
  materials += intake.scaffoldDays * (costs.scaffold_day ?? 0);
  labour    += intake.scaffoldDays * 0.5; // setup/pack

  // Multipliers
  const storeyMult  = intake.twoStorey ? 1.2 : 1;
  const siteMult    = intake.siteAccess === "easy" ? 1 : intake.siteAccess === "moderate" ? 1.15 : 1.35;

  const totalHours    = labour * storeyMult * siteMult;
  const labourCost    = totalHours * hourlyRate;
  const calloutFee    = intake.callout ? (costs.callout ?? 0) : 0;
  const matWithMargin = materials * (1 + marginPct / 100);
  const totalCost     = labourCost + matWithMargin + calloutFee;

  return {
    labourHours:   Math.round(totalHours * 10) / 10,
    materialsCost: Math.round(matWithMargin + calloutFee),
    totalCost:     Math.round(totalCost),
  };
}
