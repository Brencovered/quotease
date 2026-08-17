"use client";

import { useMemo, useState } from "react";
import {
  moneyAud,
  NumberField,
  RangeField,
  ToolPanel,
  ToolResultRow,
} from "@/components/marketing/tools/ToolShell";

export default function VehicleCostCalculator() {
  const [kmPerYear, setKmPerYear] = useState(25000);
  const [fuelPerLitre, setFuelPerLitre] = useState(1.95);
  const [litresPer100, setLitresPer100] = useState(11);
  const [rego, setRego] = useState(900);
  const [insurance, setInsurance] = useState(1800);
  const [servicing, setServicing] = useState(1200);
  const [depreciation, setDepreciation] = useState(4500);

  const result = useMemo(() => {
    const fuelYear = (kmPerYear / 100) * litresPer100 * fuelPerLitre;
    const fixed = rego + insurance + servicing + depreciation;
    const total = fuelYear + fixed;
    const perKm = kmPerYear > 0 ? total / kmPerYear : 0;
    return { fuelYear, fixed, total, perKm };
  }, [kmPerYear, fuelPerLitre, litresPer100, rego, insurance, servicing, depreciation]);

  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div className="lg:col-span-7 space-y-6">
        <ToolPanel title="Distance and fuel">
          <RangeField
            label="Kilometres per year"
            value={kmPerYear}
            min={5000}
            max={80000}
            step={500}
            onChange={setKmPerYear}
            display={`${kmPerYear.toLocaleString("en-AU")} km`}
          />
          <div className="grid sm:grid-cols-2 gap-x-5">
            <NumberField label="Fuel price" value={fuelPerLitre} onChange={setFuelPerLitre} prefix="$" min={0} step={0.01} />
            <NumberField label="Litres / 100 km" value={litresPer100} onChange={setLitresPer100} min={4} step={0.1} />
          </div>
        </ToolPanel>

        <ToolPanel title="Fixed costs (per year)">
          <div className="grid sm:grid-cols-2 gap-x-5">
            <NumberField label="Rego" value={rego} onChange={setRego} prefix="$" min={0} step={50} />
            <NumberField label="Insurance" value={insurance} onChange={setInsurance} prefix="$" min={0} step={50} />
            <NumberField label="Servicing and tyres" value={servicing} onChange={setServicing} prefix="$" min={0} step={50} />
            <NumberField label="Depreciation" value={depreciation} onChange={setDepreciation} prefix="$" min={0} step={100} />
          </div>
        </ToolPanel>
      </div>

      <div className="lg:col-span-5 lg:sticky lg:top-6">
        <ToolPanel title="True vehicle cost">
          <dl>
            <ToolResultRow label="Cost per kilometre" value={moneyAud(result.perKm, 2)} highlight />
            <ToolResultRow label="Fuel per year" value={moneyAud(result.fuelYear)} />
            <ToolResultRow label="Fixed costs per year" value={moneyAud(result.fixed)} />
            <ToolResultRow label="Total per year" value={moneyAud(result.total)} />
          </dl>
          <p className="font-sans text-[13.5px] leading-[1.6] text-[#5a6a78] mt-5">
            Add this into your charge-out overhead so site travel is not free work in disguise.
          </p>
        </ToolPanel>
      </div>
    </div>
  );
}
