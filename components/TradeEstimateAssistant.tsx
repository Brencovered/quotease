"use client";

import { useMemo, useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import {
  calcElectricianQuote,
  ELECTRICIAN_DEFAULT_MATERIALS,
  type ElectricianIntake,
} from "@/lib/calc";
import {
  calcPlumberQuote,
  PLUMBER_DEFAULT_MATERIALS,
  type PlumberIntake,
} from "@/lib/calcPlumber";
import {
  calcCarpenterQuote,
  CARPENTER_DEFAULT_MATERIALS,
  type CarpenterIntake,
} from "@/lib/calcCarpenter";
import {
  calcRooferQuote,
  ROOFER_DEFAULT_MATERIALS,
  type RooferIntake,
} from "@/lib/calcRoofer";
import {
  aggregateEstimateToScopeItems,
  costsFromMaterials,
  quoteLineItemsToScopeItems,
} from "@/lib/estimateToScopeItems";
import type { ScopeItem } from "@/components/ScopeOfWorkStep";

export type DedicatedTradeKey = "electrician" | "plumber" | "carpenter" | "roofer";

const DEFAULT_ELEC: ElectricianIntake = {
  jobType: "reno",
  ceilingType: "unknown",
  switchboardUpgrade: false,
  switchboardRcbo: false,
  switchboardRcboMode: "full_board",
  switchboardPoles: 12,
  threePhase: false,
  powerPoints: 0,
  lightPoints: 0,
  switches: 0,
  downlights: 0,
  downlightGrade: "standard",
  downlightSupply: "supply_and_fit",
  downlightProvisional: 0,
  exhaustFans: [],
  cableRuns: [],
  roofAccess: 1,
  subfloorAccess: 1,
  trenchMetres: 0,
  applianceOven: false,
  applianceCooktop: false,
  applianceHwc: false,
  applianceAircon: false,
  appliancePool: false,
  customAppliances: [],
  evCharger: false,
  solarConnection: false,
  externalCircuits: 0,
  dataPoints: 0,
  nbn: false,
  siteAccess: "na",
  multistorey: false,
  smokeAlarms: 0,
  callout: false,
  ccew: false,
};

const DEFAULT_PLUMB: PlumberIntake = {
  jobType: "reno",
  basinTaps: 0,
  kitchenTaps: 0,
  showerMixers: 0,
  bathMixers: 0,
  toilets: 0,
  hwuReplacement: false,
  hwuType: "none",
  newBathroomRoughin: false,
  newKitchenRoughin: false,
  newLaundryRoughin: false,
  gasPoints: 0,
  gasCertRequired: false,
  copperMetres: 0,
  pexMetres: 0,
  drainageMetres: 0,
  blockageClear: false,
  cctv: false,
  subfloorAccess: "none",
  slabPenetrations: 0,
  multistorey: false,
  callout: false,
  certRequired: false,
  siteAccess: "na",
};

const DEFAULT_CARP: CarpenterIntake = {
  jobType: "reno",
  internalDoors: 0,
  externalDoors: 0,
  doorFramesOnly: 0,
  skirtingMetres: 0,
  architraveMetres: 0,
  newWallFrames: 0,
  framingTimberLm: 0,
  plywoodSheets: 0,
  deckingSqm: 0,
  deckingBeamLm: 0,
  robeShelvingLm: 0,
  fasciaLm: 0,
  workingAtHeight: false,
  siteAccess: "na",
  multistorey: false,
  callout: false,
};

const DEFAULT_ROOF: RooferIntake = {
  jobType: "reroof",
  roofType: "colorbond",
  roofSqm: 0,
  roofPitch: "standard",
  ridgeLm: 0,
  valleyLm: 0,
  fasciaLm: 0,
  gutterLm: 0,
  downpipeLm: 0,
  whirlybirds: 0,
  skylights: 0,
  insulationSqm: 0,
  flashingLm: 0,
  scaffoldDays: 0,
  twoStorey: false,
  siteAccess: "easy",
  callout: false,
};

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1">{label}</span>
      <input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="app-field"
      />
    </label>
  );
}

function Chk({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-[var(--ink)] py-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export default function TradeEstimateAssistant({
  tradeKey,
  hourlyRate,
  materials,
  onApply,
  onReplace,
}: {
  tradeKey: DedicatedTradeKey;
  hourlyRate: number;
  materials: { item_key: string; label: string; unit_cost: number }[];
  onApply: (items: ScopeItem[]) => void;
  onReplace: (items: ScopeItem[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const [elec, setElec] = useState<ElectricianIntake>(DEFAULT_ELEC);
  const [plumb, setPlumb] = useState<PlumberIntake>(DEFAULT_PLUMB);
  const [carp, setCarp] = useState<CarpenterIntake>(DEFAULT_CARP);
  const [roof, setRoof] = useState<RooferIntake>(DEFAULT_ROOF);

  const preview = useMemo(() => {
    if (tradeKey === "electrician") {
      const costs = costsFromMaterials(ELECTRICIAN_DEFAULT_MATERIALS, materials);
      const result = calcElectricianQuote(elec, costs, hourlyRate, 0);
      const items = quoteLineItemsToScopeItems(result.lineItems);
      return { hours: result.labourHours, materials: result.materialsCost, items };
    }
    if (tradeKey === "plumber") {
      const costs = costsFromMaterials(PLUMBER_DEFAULT_MATERIALS, materials);
      const result = calcPlumberQuote(plumb, costs, hourlyRate, 0);
      const items = aggregateEstimateToScopeItems(result, {
        labourLabel: "Plumbing labour (estimate)",
        materialsLabel: "Plumbing materials (estimate)",
      });
      return { hours: result.labourHours, materials: result.materialsCost, items };
    }
    if (tradeKey === "carpenter") {
      const costs = costsFromMaterials(CARPENTER_DEFAULT_MATERIALS, materials);
      const result = calcCarpenterQuote(carp, costs, hourlyRate, 0);
      const items = aggregateEstimateToScopeItems(result, {
        labourLabel: "Carpentry labour (estimate)",
        materialsLabel: "Carpentry materials (estimate)",
      });
      return { hours: result.labourHours, materials: result.materialsCost, items };
    }
    const costs = costsFromMaterials(ROOFER_DEFAULT_MATERIALS, materials);
    const result = calcRooferQuote(roof, costs, hourlyRate, 0);
    const items = aggregateEstimateToScopeItems(result, {
      labourLabel: "Roofing labour (estimate)",
      materialsLabel: "Roofing materials (estimate)",
    });
    return { hours: result.labourHours, materials: result.materialsCost, items };
  }, [tradeKey, elec, plumb, carp, roof, materials, hourlyRate]);

  const title =
    tradeKey === "electrician"
      ? "Electrical estimate"
      : tradeKey === "plumber"
        ? "Plumbing estimate"
        : tradeKey === "carpenter"
          ? "Carpentry estimate"
          : "Roofing estimate";

  return (
    <div className="card border-[var(--amber)]/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--amber-deep)]" />
          <div>
            <p className="section-tag mb-0.5">Estimate assistant</p>
            <p className="text-[13px] text-[var(--ink-faint)]">
              Optional. Build a quick {title.toLowerCase()} from counts, then add it to the same scope as packages and materials.
            </p>
          </div>
        </div>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-[var(--line)] pt-4">
          {tradeKey === "electrician" && (
            <div className="grid grid-cols-2 gap-3">
              <Num label="Power points" value={elec.powerPoints} onChange={(n) => setElec((p) => ({ ...p, powerPoints: n }))} />
              <Num label="Light points" value={elec.lightPoints} onChange={(n) => setElec((p) => ({ ...p, lightPoints: n }))} />
              <Num label="Switches" value={elec.switches} onChange={(n) => setElec((p) => ({ ...p, switches: n }))} />
              <Num label="Downlights" value={elec.downlights} onChange={(n) => setElec((p) => ({ ...p, downlights: n }))} />
              <Num label="Smoke alarms" value={elec.smokeAlarms} onChange={(n) => setElec((p) => ({ ...p, smokeAlarms: n }))} />
              <Num label="Data points" value={elec.dataPoints} onChange={(n) => setElec((p) => ({ ...p, dataPoints: n }))} />
              <div className="col-span-2 space-y-1">
                <Chk label="Switchboard upgrade" checked={elec.switchboardUpgrade} onChange={(v) => setElec((p) => ({ ...p, switchboardUpgrade: v }))} />
                <Chk label="EV charger circuit" checked={elec.evCharger} onChange={(v) => setElec((p) => ({ ...p, evCharger: v }))} />
                <Chk label="Call-out fee" checked={elec.callout} onChange={(v) => setElec((p) => ({ ...p, callout: v }))} />
                <Chk label="CCEW" checked={elec.ccew} onChange={(v) => setElec((p) => ({ ...p, ccew: v }))} />
              </div>
            </div>
          )}

          {tradeKey === "plumber" && (
            <div className="grid grid-cols-2 gap-3">
              <Num label="Basin taps" value={plumb.basinTaps} onChange={(n) => setPlumb((p) => ({ ...p, basinTaps: n }))} />
              <Num label="Kitchen taps" value={plumb.kitchenTaps} onChange={(n) => setPlumb((p) => ({ ...p, kitchenTaps: n }))} />
              <Num label="Shower mixers" value={plumb.showerMixers} onChange={(n) => setPlumb((p) => ({ ...p, showerMixers: n }))} />
              <Num label="Toilets" value={plumb.toilets} onChange={(n) => setPlumb((p) => ({ ...p, toilets: n }))} />
              <Num label="Copper (m)" value={plumb.copperMetres} onChange={(n) => setPlumb((p) => ({ ...p, copperMetres: n }))} />
              <Num label="Drainage (m)" value={plumb.drainageMetres} onChange={(n) => setPlumb((p) => ({ ...p, drainageMetres: n }))} />
              <div className="col-span-2 space-y-1">
                <Chk label="Hot water replacement" checked={plumb.hwuReplacement} onChange={(v) => setPlumb((p) => ({ ...p, hwuReplacement: v, hwuType: v ? "electric" : "none" }))} />
                <Chk label="Bathroom rough-in" checked={plumb.newBathroomRoughin} onChange={(v) => setPlumb((p) => ({ ...p, newBathroomRoughin: v }))} />
                <Chk label="Call-out fee" checked={plumb.callout} onChange={(v) => setPlumb((p) => ({ ...p, callout: v }))} />
              </div>
            </div>
          )}

          {tradeKey === "carpenter" && (
            <div className="grid grid-cols-2 gap-3">
              <Num label="Internal doors" value={carp.internalDoors} onChange={(n) => setCarp((p) => ({ ...p, internalDoors: n }))} />
              <Num label="External doors" value={carp.externalDoors} onChange={(n) => setCarp((p) => ({ ...p, externalDoors: n }))} />
              <Num label="Skirting (m)" value={carp.skirtingMetres} onChange={(n) => setCarp((p) => ({ ...p, skirtingMetres: n }))} />
              <Num label="Architrave (m)" value={carp.architraveMetres} onChange={(n) => setCarp((p) => ({ ...p, architraveMetres: n }))} />
              <Num label="New wall frames" value={carp.newWallFrames} onChange={(n) => setCarp((p) => ({ ...p, newWallFrames: n }))} />
              <Num label="Decking (sqm)" value={carp.deckingSqm} onChange={(n) => setCarp((p) => ({ ...p, deckingSqm: n }))} />
              <div className="col-span-2 space-y-1">
                <Chk label="Working at height" checked={carp.workingAtHeight} onChange={(v) => setCarp((p) => ({ ...p, workingAtHeight: v }))} />
                <Chk label="Call-out / measure fee" checked={carp.callout} onChange={(v) => setCarp((p) => ({ ...p, callout: v }))} />
              </div>
            </div>
          )}

          {tradeKey === "roofer" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block col-span-2">
                <span className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1">Roof type</span>
                <select
                  value={roof.roofType}
                  onChange={(e) => setRoof((p) => ({ ...p, roofType: e.target.value as RooferIntake["roofType"] }))}
                  className="app-field"
                >
                  <option value="colorbond">Colorbond</option>
                  <option value="terracotta">Terracotta</option>
                  <option value="concrete_tile">Concrete tile</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>
              <Num label="Roof area (sqm)" value={roof.roofSqm} onChange={(n) => setRoof((p) => ({ ...p, roofSqm: n }))} />
              <label className="block">
                <span className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1">Pitch</span>
                <select
                  value={roof.roofPitch}
                  onChange={(e) => setRoof((p) => ({ ...p, roofPitch: e.target.value as RooferIntake["roofPitch"] }))}
                  className="app-field"
                >
                  <option value="low">Low</option>
                  <option value="standard">Standard</option>
                  <option value="steep">Steep</option>
                </select>
              </label>
              <Num label="Ridge (LM)" value={roof.ridgeLm} onChange={(n) => setRoof((p) => ({ ...p, ridgeLm: n }))} />
              <Num label="Valley (LM)" value={roof.valleyLm} onChange={(n) => setRoof((p) => ({ ...p, valleyLm: n }))} />
              <Num label="Gutter (LM)" value={roof.gutterLm} onChange={(n) => setRoof((p) => ({ ...p, gutterLm: n }))} />
              <Num label="Scaffold days" value={roof.scaffoldDays} onChange={(n) => setRoof((p) => ({ ...p, scaffoldDays: n }))} />
              <div className="col-span-2 space-y-1">
                <Chk label="Two-storey" checked={roof.twoStorey} onChange={(v) => setRoof((p) => ({ ...p, twoStorey: v }))} />
                <Chk label="Call-out / inspection fee" checked={roof.callout} onChange={(v) => setRoof((p) => ({ ...p, callout: v }))} />
              </div>
            </div>
          )}

          <div className="rounded-xl bg-[var(--app-bg)] px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] text-[var(--ink-faint)] font-semibold uppercase tracking-wide">Preview (ex GST, before margin)</p>
              <p className="text-[14px] text-[var(--ink)] mt-0.5">
                {preview.hours}h labour · ${preview.materials.toLocaleString()} materials · {preview.items.length} line{preview.items.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                type="button"
                disabled={preview.items.length === 0}
                onClick={() => onApply(preview.items)}
                className="btn-secondary text-[13px] px-3 py-2 disabled:opacity-40"
              >
                Add to scope
              </button>
              <button
                type="button"
                disabled={preview.items.length === 0}
                onClick={() => onReplace(preview.items)}
                className="btn-primary text-[13px] px-3 py-2 disabled:opacity-40"
              >
                Replace estimate lines
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const DEDICATED_ESTIMATE_TRADES = new Set<string>([
  "electrician",
  "plumber",
  "carpenter",
  "roofer",
]);
