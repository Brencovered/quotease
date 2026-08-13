"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

function money(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

export default function ChargeOutCalculator() {
  const [takeHome, setTakeHome] = useState(120000);
  const [overhead, setOverhead] = useState(35000);
  const [billableDays, setBillableDays] = useState(180);
  const [hoursPerDay, setHoursPerDay] = useState(7);
  const [profitMargin, setProfitMargin] = useState(20);

  const result = useMemo(() => {
    const annualCost = takeHome + overhead;
    const billableHours = Math.max(billableDays, 1) * Math.max(hoursPerDay, 1);
    const breakEvenHourly = annualCost / billableHours;
    const chargeHourly = breakEvenHourly / (1 - Math.min(Math.max(profitMargin, 0), 90) / 100);
    const chargeDay = chargeHourly * hoursPerDay;
    return { billableHours, breakEvenHourly, chargeHourly, chargeDay };
  }, [takeHome, overhead, billableDays, hoursPerDay, profitMargin]);

  return (
    <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
      <div className="lg:col-span-6 space-y-5">
        <Field
          label="Desired take-home pay (per year)"
          value={takeHome}
          min={40000}
          max={300000}
          step={1000}
          onChange={setTakeHome}
          suffix="/yr"
        />
        <Field
          label="Business overhead (insurance, fuel, tools, rent)"
          value={overhead}
          min={0}
          max={200000}
          step={1000}
          onChange={setOverhead}
          suffix="/yr"
        />
        <Field
          label="Billable days per year"
          value={billableDays}
          min={80}
          max={260}
          step={1}
          onChange={setBillableDays}
          suffix="days"
          format={(n) => String(n)}
        />
        <Field
          label="Billable hours per day"
          value={hoursPerDay}
          min={4}
          max={10}
          step={0.5}
          onChange={setHoursPerDay}
          suffix="hrs"
          format={(n) => String(n)}
        />
        <Field
          label="Profit margin on top of costs"
          value={profitMargin}
          min={0}
          max={50}
          step={1}
          onChange={setProfitMargin}
          suffix="%"
          format={(n) => String(n)}
        />
      </div>

      <div className="lg:col-span-6">
        <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-6 sm:p-8">
          <p className="font-sans text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-5">
            Your charge-out targets
          </p>
          <dl className="space-y-5">
            <ResultRow label="Break-even hourly" value={money(result.breakEvenHourly)} />
            <ResultRow label="Charge-out hourly" value={money(result.chargeHourly)} highlight />
            <ResultRow label="Charge-out day rate" value={money(result.chargeDay)} highlight />
            <ResultRow
              label="Billable hours modelled"
              value={`${Math.round(result.billableHours).toLocaleString("en-AU")} hrs/yr`}
            />
          </dl>
          <p className="font-sans text-[13px] leading-[1.6] text-white/45 mt-6 mb-7">
            This is a planning number, not a quote. Put your real labour rates into Swiftscope and price each job from your book on site.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-5 py-3 rounded-lg hover:bg-[#e89e00] transition-colors"
          >
            Build quotes with these rates <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4">
      <dt className="font-sans text-[13.5px] text-white/55">{label}</dt>
      <dd
        className={[
          "font-display tracking-wide",
          highlight ? "text-[1.7rem] text-[#ffb400]" : "text-[1.25rem] text-white",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

function Field({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
  format = money,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  suffix: string;
  format?: (n: number) => string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="font-sans text-[13.5px] font-semibold text-white/80">{label}</span>
        <span className="font-sans text-[13px] font-bold text-[#ffb400] tabular-nums">
          {format(value)} {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#ffb400]"
      />
    </label>
  );
}
