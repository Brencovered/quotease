export const CARPENTER_DEFAULT_MATERIALS = [
  { item_key: "framing_lm",     label: "Framing timber, per LM",       unit_cost: 8   },
  { item_key: "sheet_ply",      label: "Structural ply sheet (2400×1200)", unit_cost: 65  },
  { item_key: "sheet_mdf",      label: "MDF sheet (2400×1200)",         unit_cost: 45  },
  { item_key: "door_internal",  label: "Internal door (supplied)",       unit_cost: 180 },
  { item_key: "door_external",  label: "External door (supplied)",       unit_cost: 420 },
  { item_key: "door_hardware",  label: "Door hardware (handle + hinges)",unit_cost: 65  },
  { item_key: "skirting_lm",    label: "Skirting board, per LM",         unit_cost: 7   },
  { item_key: "architrave_lm",  label: "Architrave, per LM",             unit_cost: 6   },
  { item_key: "decking_lm",     label: "Decking board, per LM (hardwood)",unit_cost: 22  },
  { item_key: "decking_bearer", label: "Decking bearer / joist, per LM", unit_cost: 14  },
  { item_key: "stud_lm",        label: "Wall stud (90×45), per LM",      unit_cost: 5   },
  { item_key: "noggin_lm",      label: "Noggins / blocking, per LM",     unit_cost: 4   },
  { item_key: "bath_frame",     label: "Bathroom frame pack (studs + nogg)", unit_cost: 180 },
  { item_key: "robe_shelf_lm",  label: "Robe shelf (melamine), per LM",  unit_cost: 18  },
  { item_key: "fascia_lm",      label: "Fascia / barge board, per LM",   unit_cost: 12  },
  { item_key: "callout",        label: "Call-out / measure fee",          unit_cost: 150 },
  { item_key: "fixings",        label: "Fixings, adhesives (allowance)",  unit_cost: 45  },
] as const;

export interface CarpenterIntake {
  jobType: "reno" | "newbuild" | "deck" | "framing" | "fitout" | "repair";
  // Doors
  internalDoors: number;
  externalDoors: number;
  doorFramesOnly: number;
  // Trim
  skirtingMetres: number;
  architraveMetres: number;
  // Framing
  newWallFrames: number;  // number of new stud walls (per 3m length)
  framingTimberLm: number;
  plywoodSheets: number;
  // Decking
  deckingSqm: number;
  deckingBeamLm: number;
  // Fitout
  robeShelvingLm: number;
  // Roofline
  fasciaLm: number;
  // Access / site
  workingAtHeight: boolean; // requires scaffolding allowance in labour
  siteAccess: "easy" | "moderate" | "difficult";
  multistorey: boolean;
  callout: boolean;
  notes?: string;
}

export interface CarpenterQuoteResult {
  labourHours: number;
  materialsCost: number;
  totalCost: number;
}

export function calcCarpenterQuote(
  intake: CarpenterIntake,
  costs: Record<string, number>,
  hourlyRate: number,
  marginPct: number
): CarpenterQuoteResult {
  let labour = 0;
  let materials = 0;

  // Doors - hang + hardware: 1.5h per internal, 2.5h per external
  labour    += intake.internalDoors * 1.5;
  materials += intake.internalDoors * ((costs.door_internal ?? 0) + (costs.door_hardware ?? 0));

  labour    += intake.externalDoors * 2.5;
  materials += intake.externalDoors * ((costs.door_external ?? 0) + (costs.door_hardware ?? 0));

  labour    += intake.doorFramesOnly * 1;

  // Trim
  labour    += (intake.skirtingMetres + intake.architraveMetres) * 0.08; // ~5 min per LM
  materials += intake.skirtingMetres   * (costs.skirting_lm   ?? 0);
  materials += intake.architraveMetres * (costs.architrave_lm ?? 0);

  // Framing
  labour    += intake.newWallFrames   * 3;  // 3h per 3m stud wall
  labour    += intake.framingTimberLm * 0.05;
  materials += intake.framingTimberLm * (costs.framing_lm ?? 0);
  materials += intake.plywoodSheets   * (costs.sheet_ply  ?? 0);
  materials += intake.newWallFrames   * (costs.fixings    ?? 0);

  // Decking - supply + lay: 1h per sqm, plus bearer framing
  labour    += intake.deckingSqm    * 1;
  materials += intake.deckingSqm    * (costs.decking_lm     ?? 0) * 1.1; // 10% waste
  labour    += intake.deckingBeamLm * 0.25;
  materials += intake.deckingBeamLm * (costs.decking_bearer ?? 0);

  // Fitout
  labour    += intake.robeShelvingLm * 0.5;
  materials += intake.robeShelvingLm * (costs.robe_shelf_lm ?? 0);

  // Roofline
  labour    += intake.fasciaLm * 0.2;
  materials += intake.fasciaLm * (costs.fascia_lm ?? 0);

  // Height / access
  const heightMult  = intake.workingAtHeight ? 1.25 : 1;
  const siteMult    = intake.siteAccess === "easy" ? 1 : intake.siteAccess === "moderate" ? 1.15 : 1.35;
  const storeyMult  = intake.multistorey ? 1.1 : 1;

  const totalHours   = labour * heightMult * siteMult * storeyMult;
  const labourCost   = totalHours * hourlyRate;
  const calloutFee   = intake.callout ? (costs.callout ?? 0) : 0;

  // Always include a fixings allowance
  materials += costs.fixings ?? 0;

  const matWithMargin = materials * (1 + marginPct / 100);
  const totalCost = labourCost + matWithMargin + calloutFee;

  return {
    labourHours:   Math.round(totalHours * 10) / 10,
    materialsCost: Math.round(matWithMargin + calloutFee),
    totalCost:     Math.round(totalCost),
  };
}
