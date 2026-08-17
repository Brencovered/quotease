"use client";

import { useMemo, useState } from "react";
import {
  moneyAud,
  NumberField,
  RangeField,
  ToolPanel,
  ToolResultRow,
} from "@/components/marketing/tools/ToolShell";

export default function ChargeOutCalculator() {
  const [takeHome, setTakeHome] = useState(120000);
  const [vehicle, setVehicle] = useState(12000);
  const [insurance, setInsurance] = useState(4500);
  const [tools, setTools] = useState(3000);
  const [superannuation, setSuperannuation] = useState(12000);
  const [swiftscope, setSwiftscope] = useState(540);
  const [otherOverhead, setOtherOverhead] = useState(5000);
  const [billableWeeks, setBillableWeeks] = useState(46);
  const [hoursPerWeek, setHoursPerWeek] = useState(32);
  const [profitMargin, setProfitMargin] = useState(20);

  const result = useMemo(() => {
    const overhead =
      vehicle + insurance + tools + superannuation + swiftscope + otherOverhead;
    const annualCost = takeHome + overhead;
    const billableHours = Math.max(billableWeeks, 1) * Math.max(hoursPerWeek, 1);
    const breakEvenHourly = annualCost / billableHours;
    const chargeHourly =
      breakEvenHourly / (1 - Math.min(Math.max(profitMargin, 0), 90) / 100);
    const chargeDay = chargeHourly * (hoursPerWeek / 5);
    return { overhead, billableHours, breakEvenHourly, chargeHourly, chargeDay };
  }, [
    takeHome,
    vehicle,
    insurance,
    tools,
    superannuation,
    swiftscope,
    otherOverhead,
    billableWeeks,
    hoursPerWeek,
    profitMargin,
  ]);

  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div className="lg:col-span-7 space-y-6">
        <ToolPanel title="Income target">
          <RangeField
            label="Desired take-home pay"
            value={takeHome}
            min={40000}
            max={300000}
            step={1000}
            onChange={setTakeHome}
            display={`${moneyAud(takeHome)} /yr`}
          />
        </ToolPanel>

        <ToolPanel title="Hidden costs (per year)">
          <div className="grid sm:grid-cols-2 gap-x-5">
            <NumberField label="Vehicle / fuel / lease" value={vehicle} onChange={setVehicle} prefix="$" min={0} step={100} />
            <NumberField label="Insurance" value={insurance} onChange={setInsurance} prefix="$" min={0} step={100} />
            <NumberField label="Tools and consumables" value={tools} onChange={setTools} prefix="$" min={0} step={100} />
            <NumberField label="Superannuation" value={superannuation} onChange={setSuperannuation} prefix="$" min={0} step={100} />
            <NumberField label="Swiftscope subscription" value={swiftscope} onChange={setSwiftscope} prefix="$" min={0} step={45} />
            <NumberField label="Other overhead" value={otherOverhead} onChange={setOtherOverhead} prefix="$" min={0} step={100} />
          </div>
          <p className="font-sans text-[13px] text-[#5a6a78] mt-2">
            Total overhead modelled:{" "}
            <strong className="font-sans font-bold text-[#071018]">{moneyAud(result.overhead)}</strong> /yr
          </p>
        </ToolPanel>

        <ToolPanel title="Billable time">
          <RangeField
            label="Billable weeks per year"
            value={billableWeeks}
            min={30}
            max={50}
            step={1}
            onChange={setBillableWeeks}
            display={`${billableWeeks} weeks`}
          />
          <RangeField
            label="Billable hours per week"
            value={hoursPerWeek}
            min={10}
            max={50}
            step={1}
            onChange={setHoursPerWeek}
            display={`${hoursPerWeek} hrs`}
          />
          <RangeField
            label="Profit margin on top of costs"
            value={profitMargin}
            min={0}
            max={50}
            step={1}
            onChange={setProfitMargin}
            display={`${profitMargin}%`}
          />
        </ToolPanel>
      </div>

      <div className="lg:col-span-5 lg:sticky lg:top-6">
        <ToolPanel title="Your true charge-out">
          <dl>
            <ToolResultRow label="Break-even hourly" value={moneyAud(result.breakEvenHourly)} />
            <ToolResultRow label="Charge-out hourly" value={moneyAud(result.chargeHourly)} highlight />
            <ToolResultRow
              label="Approx day rate"
              value={moneyAud(result.chargeDay)}
              highlight
              hint="Assumes a 5-day week from your weekly hours."
            />
            <ToolResultRow
              label="Billable hours modelled"
              value={`${Math.round(result.billableHours).toLocaleString("en-AU")} hrs/yr`}
            />
          </dl>
          <p className="font-sans text-[13.5px] leading-[1.6] text-[#5a6a78] mt-5">
            Planning number only. Load your real labour rate into Swiftscope and price every job from your book on site.
          </p>
        </ToolPanel>
      </div>
    </div>
  );
}
