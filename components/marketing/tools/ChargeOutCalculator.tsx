"use client";

import { useMemo, useState } from "react";
import {
  moneyAud,
  NumberField,
  RangeField,
  ToolPanel,
  ToolResultRow,
} from "@/components/marketing/tools/ToolShell";

/**
 * True charge-out:
 * (Net + Tax + Super + Workers comp + Overheads) ÷ actual annual billable hours
 *
 * Unbillable time, leave, and public holidays reduce the denominator so the
 * rate reflects real on-tools hours, not a fantasy 2,000-hour year.
 */
export default function ChargeOutCalculator() {
  const [netPay, setNetPay] = useState(100000);
  const [effectiveTaxPct, setEffectiveTaxPct] = useState(28);
  const [superPct, setSuperPct] = useState(12);
  const [workersComp, setWorkersComp] = useState(2500);
  const [rego, setRego] = useState(900);
  const [insurance, setInsurance] = useState(3500);
  const [software, setSoftware] = useState(540);
  const [tools, setTools] = useState(2500);
  const [otherOverhead, setOtherOverhead] = useState(4000);

  const [hoursPerWeek, setHoursPerWeek] = useState(45);
  const [unbillablePerWeek, setUnbillablePerWeek] = useState(14);
  const [leaveWeeks, setLeaveWeeks] = useState(4);
  const [publicHolidays, setPublicHolidays] = useState(11);
  const [profitBuffer, setProfitBuffer] = useState(15);

  const result = useMemo(() => {
    const tax = netPay * (Math.min(Math.max(effectiveTaxPct, 0), 55) / 100);
    const grossLike = netPay + tax;
    const superAmount = grossLike * (Math.min(Math.max(superPct, 0), 20) / 100);
    const fixedOverhead = rego + insurance + software + tools + otherOverhead;
    const totalToRecover = netPay + tax + superAmount + workersComp + fixedOverhead;

    const holidayWeeks = Math.max(publicHolidays, 0) / 5;
    const workingWeeks = Math.max(52 - leaveWeeks - holidayWeeks, 1);
    const billablePerWeek = Math.max(hoursPerWeek - unbillablePerWeek, 0);
    const annualBillable = workingWeeks * billablePerWeek;

    const breakEven = annualBillable > 0 ? totalToRecover / annualBillable : 0;
    const chargeOut =
      breakEven / (1 - Math.min(Math.max(profitBuffer, 0), 80) / 100);
    const dayRate = chargeOut * Math.min(billablePerWeek, 8);

    const naiveRate = netPay / 2000;
    const unbillableShare =
      hoursPerWeek > 0 ? (unbillablePerWeek / hoursPerWeek) * 100 : 0;

    return {
      tax,
      superAmount,
      fixedOverhead,
      totalToRecover,
      workingWeeks,
      billablePerWeek,
      annualBillable,
      breakEven,
      chargeOut,
      dayRate,
      naiveRate,
      unbillableShare,
      gapVsNaive: chargeOut - naiveRate,
    };
  }, [
    netPay,
    effectiveTaxPct,
    superPct,
    workersComp,
    rego,
    insurance,
    software,
    tools,
    otherOverhead,
    hoursPerWeek,
    unbillablePerWeek,
    leaveWeeks,
    publicHolidays,
    profitBuffer,
  ]);

  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div className="lg:col-span-7 space-y-6">
        <ToolPanel title="What you need to take home">
          <RangeField
            label="Desired annual net pay"
            value={netPay}
            min={40000}
            max={250000}
            step={1000}
            onChange={setNetPay}
            display={`${moneyAud(netPay)} /yr`}
          />
          <RangeField
            label="Estimated tax + Medicare (effective)"
            value={effectiveTaxPct}
            min={0}
            max={45}
            step={1}
            onChange={setEffectiveTaxPct}
            display={`${effectiveTaxPct}% ≈ ${moneyAud(result.tax)}`}
          />
          <p className="font-sans text-[13px] leading-[1.6] text-[#5a6a78]">
            Rough planning rate only. Your accountant will refine the tax figure. Default assumes a typical sole-trader effective rate.
          </p>
        </ToolPanel>

        <ToolPanel title="Super, cover, and fixed overheads">
          <RangeField
            label="Superannuation rate (SG)"
            value={superPct}
            min={0}
            max={15}
            step={0.5}
            onChange={setSuperPct}
            display={`${superPct}% ≈ ${moneyAud(result.superAmount)}`}
          />
          <p className="font-sans text-[13px] leading-[1.6] text-[#5a6a78] mb-4">
            Australian Super Guarantee is currently 12% of ordinary time earnings. This slider is a planning input only.{" "}
            <a
              href="https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#071018] underline underline-offset-2 hover:text-[#b88400]"
            >
              ATO Super Guarantee rates
            </a>
            {" · "}
            <a
              href="https://digit.business/insights/people-payroll/super-guarantee-rate-2025-26-australia"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#071018] underline underline-offset-2 hover:text-[#b88400]"
            >
              Digit employer guide
            </a>
          </p>
          <div className="grid sm:grid-cols-2 gap-x-5">
            <NumberField label="Workers compensation" value={workersComp} onChange={setWorkersComp} prefix="$" min={0} step={50} />
            <NumberField label="Rego" value={rego} onChange={setRego} prefix="$" min={0} step={50} />
            <NumberField label="Insurance" value={insurance} onChange={setInsurance} prefix="$" min={0} step={50} />
            <NumberField label="Software (incl. Swiftscope)" value={software} onChange={setSoftware} prefix="$" min={0} step={45} />
            <NumberField label="Tools / consumables" value={tools} onChange={setTools} prefix="$" min={0} step={50} />
            <NumberField label="Other overhead" value={otherOverhead} onChange={setOtherOverhead} prefix="$" min={0} step={100} />
          </div>
          <p className="font-sans text-[13px] text-[#5a6a78] mt-1">
            Fixed overheads total{" "}
            <strong className="font-sans font-bold text-[#071018]">{moneyAud(result.fixedOverhead)}</strong> /yr
          </p>
        </ToolPanel>

        <ToolPanel title="Real billable time">
          <RangeField
            label="Hours worked per week"
            value={hoursPerWeek}
            min={30}
            max={60}
            step={1}
            onChange={setHoursPerWeek}
            display={`${hoursPerWeek} hrs`}
          />
          <RangeField
            label="Unbillable hours (admin, drive, quote, chase)"
            value={unbillablePerWeek}
            min={0}
            max={30}
            step={1}
            onChange={setUnbillablePerWeek}
            display={`${unbillablePerWeek} hrs · ${result.unbillableShare.toFixed(0)}% of week`}
          />
          <RangeField
            label="Annual leave"
            value={leaveWeeks}
            min={0}
            max={8}
            step={0.5}
            onChange={setLeaveWeeks}
            display={`${leaveWeeks} weeks`}
          />
          <RangeField
            label="Public holidays"
            value={publicHolidays}
            min={0}
            max={15}
            step={1}
            onChange={setPublicHolidays}
            display={`${publicHolidays} days`}
          />
          <RangeField
            label="Profit buffer on top of break-even"
            value={profitBuffer}
            min={0}
            max={40}
            step={1}
            onChange={setProfitBuffer}
            display={`${profitBuffer}%`}
          />
        </ToolPanel>
      </div>

      <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-6">
        <ToolPanel title="Your true charge-out">
          <dl>
            <ToolResultRow
              label="True charge-out hourly"
              value={moneyAud(result.chargeOut)}
              highlight
            />
            <ToolResultRow label="Break-even hourly" value={moneyAud(result.breakEven)} />
            <ToolResultRow
              label="Day rate (up to 8 billable hrs)"
              value={moneyAud(result.dayRate)}
              highlight
            />
            <ToolResultRow
              label="Actual billable hours / year"
              value={`${Math.round(result.annualBillable).toLocaleString("en-AU")} hrs`}
              hint={`${result.workingWeeks.toFixed(1)} working weeks × ${result.billablePerWeek} billable hrs`}
            />
            <ToolResultRow
              label="Total to recover per year"
              value={moneyAud(result.totalToRecover)}
            />
          </dl>
        </ToolPanel>

        <ToolPanel title="Why the naive rate fails">
          <dl>
            <ToolResultRow
              label="Net ÷ 2,000 hours"
              value={moneyAud(result.naiveRate)}
              hint="Ignores tax, super, overheads, leave, and unbillable time."
            />
            <ToolResultRow
              label="You would undercharge by"
              value={moneyAud(Math.max(result.gapVsNaive, 0))}
              highlight
              hint="Per hour, before you even open the quote."
            />
          </dl>
        </ToolPanel>
      </div>
    </div>
  );
}
