"use client";

import { useMemo, useState } from "react";
import {
  moneyAud,
  NumberField,
  RangeField,
  ToolPanel,
  ToolResultRow,
  ToolToggle,
} from "@/components/marketing/tools/ToolShell";

/** ATO cents-per-km rate for 2024-25 / 2025-26 planning (88c). */
const ATO_CENTS_PER_KM = 0.88;

type VehicleType = "ute" | "van" | "truck";

const VEHICLE_DEFAULTS: Record<
  VehicleType,
  { label: string; litresPer100: number; depreciation: number; servicing: number }
> = {
  ute: { label: "Ute", litresPer100: 11, depreciation: 4500, servicing: 1400 },
  van: { label: "Van", litresPer100: 12, depreciation: 5000, servicing: 1600 },
  truck: { label: "Truck", litresPer100: 18, depreciation: 8000, servicing: 2800 },
};

export default function VehicleCostCalculator() {
  const [vehicleType, setVehicleType] = useState<VehicleType>("ute");
  const [kmPerYear, setKmPerYear] = useState(25000);
  const [workDays, setWorkDays] = useState(220);
  const [fuelSpend, setFuelSpend] = useState(6500);
  const [rego, setRego] = useState(900);
  const [insurance, setInsurance] = useState(1800);
  const [servicing, setServicing] = useState(VEHICLE_DEFAULTS.ute.servicing);
  const [tyres, setTyres] = useState(800);
  const [depreciation, setDepreciation] = useState(VEHICLE_DEFAULTS.ute.depreciation);
  const [toolPool, setToolPool] = useState(2000);

  function selectType(id: string) {
    const next = id as VehicleType;
    setVehicleType(next);
    setServicing(VEHICLE_DEFAULTS[next].servicing);
    setDepreciation(VEHICLE_DEFAULTS[next].depreciation);
  }

  const result = useMemo(() => {
    const fixed =
      rego + insurance + servicing + tyres + depreciation + toolPool;
    const total = fuelSpend + fixed;
    const perKm = kmPerYear > 0 ? total / kmPerYear : 0;
    const dailyKm = workDays > 0 ? kmPerYear / workDays : 0;
    const dailyRolling = workDays > 0 ? total / workDays : 0;
    const atoPerKm = ATO_CENTS_PER_KM;
    const vsAto = perKm - atoPerKm;
    return { fixed, total, perKm, dailyKm, dailyRolling, atoPerKm, vsAto };
  }, [
    kmPerYear,
    workDays,
    fuelSpend,
    rego,
    insurance,
    servicing,
    tyres,
    depreciation,
    toolPool,
  ]);

  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div className="lg:col-span-7 space-y-6">
        <ToolPanel title="Vehicle and use">
          <ToolToggle
            value={vehicleType}
            onChange={selectType}
            options={[
              { id: "ute", label: "Ute" },
              { id: "van", label: "Van" },
              { id: "truck", label: "Truck" },
            ]}
          />
          <RangeField
            label="Kilometres per year"
            value={kmPerYear}
            min={5000}
            max={80000}
            step={500}
            onChange={setKmPerYear}
            display={`${kmPerYear.toLocaleString("en-AU")} km`}
          />
          <RangeField
            label="Work days on the road per year"
            value={workDays}
            min={120}
            max={280}
            step={1}
            onChange={setWorkDays}
            display={`${workDays} days`}
          />
          <NumberField
            label="Annual fuel spend"
            value={fuelSpend}
            onChange={setFuelSpend}
            prefix="$"
            min={0}
            step={100}
          />
        </ToolPanel>

        <ToolPanel title="Wear, cover, and tool replacement">
          <div className="grid sm:grid-cols-2 gap-x-5">
            <NumberField label="Rego" value={rego} onChange={setRego} prefix="$" min={0} step={50} />
            <NumberField label="Insurance" value={insurance} onChange={setInsurance} prefix="$" min={0} step={50} />
            <NumberField label="Servicing" value={servicing} onChange={setServicing} prefix="$" min={0} step={50} />
            <NumberField label="Tyres" value={tyres} onChange={setTyres} prefix="$" min={0} step={50} />
            <NumberField label="Depreciation" value={depreciation} onChange={setDepreciation} prefix="$" min={0} step={100} />
            <NumberField
              label="Annual tool replacement pool"
              value={toolPool}
              onChange={setToolPool}
              prefix="$"
              min={0}
              step={50}
            />
          </div>
          <p className="font-sans text-[13px] leading-[1.6] text-[#5a6a78]">
            Tool pool covers grinders, batteries, blades, and the gear that dies on site and never gets charged back.
          </p>
        </ToolPanel>
      </div>

      <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-6">
        <ToolPanel title="True running cost">
          <dl>
            <ToolResultRow
              label="Cost per kilometre"
              value={moneyAud(result.perKm, 2)}
              highlight
            />
            <ToolResultRow
              label="Daily rolling overhead"
              value={moneyAud(result.dailyRolling)}
              highlight
              hint={`About ${result.dailyKm.toFixed(0)} km/day averaged across work days.`}
            />
            <ToolResultRow label="Total per year" value={moneyAud(result.total)} />
            <ToolResultRow label="Fuel per year" value={moneyAud(fuelSpend)} />
            <ToolResultRow label="Fixed + tools per year" value={moneyAud(result.fixed)} />
          </dl>
        </ToolPanel>

        <ToolPanel title="ATO cents-per-km check">
          <dl>
            <ToolResultRow
              label="ATO rate (88c/km)"
              value={moneyAud(result.atoPerKm, 2)}
              hint="Standard ATO cents-per-kilometre rate for planning."
            />
            <ToolResultRow
              label={result.vsAto >= 0 ? "Your cost above ATO" : "Your cost below ATO"}
              value={moneyAud(Math.abs(result.vsAto), 2)}
              highlight
            />
          </dl>
          <p className="font-sans text-[13px] leading-[1.6] text-[#5a6a78] mt-4">
            Benchmark only. The ATO cents-per-km rate is 88c for 2024-25 and 2025-26 (rates change by year).{" "}
            <a
              href="https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/cars-transport-and-travel/motor-vehicle-and-car-expenses/expenses-for-a-car-you-own-or-lease/cents-per-kilometre-method"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#071018] underline underline-offset-2 hover:text-[#b88400]"
            >
              ATO cents-per-kilometre method
            </a>
            . This comparison is not a deduction claim tool.
          </p>
        </ToolPanel>
      </div>
    </div>
  );
}
