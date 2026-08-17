"use client";

import { useMemo, useState } from "react";
import {
  moneyAud,
  RangeField,
  ToolPanel,
  ToolResultRow,
} from "@/components/marketing/tools/ToolShell";

type JobKey =
  | "bathroom"
  | "kitchen"
  | "split-ac"
  | "rewire"
  | "fence"
  | "roof"
  | "paint-interior"
  | "deck";

const JOBS: {
  key: JobKey;
  label: string;
  unit: string;
  minSize: number;
  maxSize: number;
  step: number;
  defaultSize: number;
  /** Rough AUD low/high per unit at mid complexity */
  lowPer: number;
  highPer: number;
  baseLow: number;
  baseHigh: number;
}[] = [
  {
    key: "bathroom",
    label: "Bathroom renovation",
    unit: "m²",
    minSize: 3,
    maxSize: 12,
    step: 0.5,
    defaultSize: 6,
    lowPer: 1800,
    highPer: 3200,
    baseLow: 8000,
    baseHigh: 12000,
  },
  {
    key: "kitchen",
    label: "Kitchen renovation",
    unit: "m²",
    minSize: 6,
    maxSize: 25,
    step: 1,
    defaultSize: 12,
    lowPer: 1200,
    highPer: 2200,
    baseLow: 10000,
    baseHigh: 18000,
  },
  {
    key: "split-ac",
    label: "Install split system AC",
    unit: "kW capacity",
    minSize: 2.5,
    maxSize: 8,
    step: 0.5,
    defaultSize: 3.5,
    lowPer: 450,
    highPer: 750,
    baseLow: 1800,
    baseHigh: 2800,
  },
  {
    key: "rewire",
    label: "House rewire",
    unit: "rooms",
    minSize: 4,
    maxSize: 16,
    step: 1,
    defaultSize: 8,
    lowPer: 900,
    highPer: 1600,
    baseLow: 4000,
    baseHigh: 7000,
  },
  {
    key: "fence",
    label: "Boundary fence",
    unit: "metres",
    minSize: 10,
    maxSize: 60,
    step: 1,
    defaultSize: 25,
    lowPer: 90,
    highPer: 180,
    baseLow: 800,
    baseHigh: 1500,
  },
  {
    key: "roof",
    label: "Re-roof (metal)",
    unit: "m²",
    minSize: 80,
    maxSize: 280,
    step: 5,
    defaultSize: 150,
    lowPer: 70,
    highPer: 130,
    baseLow: 2000,
    baseHigh: 4500,
  },
  {
    key: "paint-interior",
    label: "Interior house paint",
    unit: "rooms",
    minSize: 2,
    maxSize: 12,
    step: 1,
    defaultSize: 5,
    lowPer: 450,
    highPer: 900,
    baseLow: 600,
    baseHigh: 1200,
  },
  {
    key: "deck",
    label: "Timber deck",
    unit: "m²",
    minSize: 8,
    maxSize: 50,
    step: 1,
    defaultSize: 20,
    lowPer: 280,
    highPer: 520,
    baseLow: 1500,
    baseHigh: 3000,
  },
];

export default function BallparkEstimator() {
  const [jobKey, setJobKey] = useState<JobKey>("bathroom");
  const activeJob = JOBS.find((j) => j.key === jobKey) ?? JOBS[0];
  const [size, setSize] = useState(activeJob.defaultSize);

  const range = useMemo(() => {
    const low = activeJob.baseLow + activeJob.lowPer * size;
    const high = activeJob.baseHigh + activeJob.highPer * size;
    return { low, high, mid: (low + high) / 2 };
  }, [activeJob, size]);

  function selectJob(key: JobKey) {
    const next = JOBS.find((j) => j.key === key) ?? JOBS[0];
    setJobKey(key);
    setSize(next.defaultSize);
  }

  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div className="lg:col-span-7 space-y-6">
        <ToolPanel title="Job type">
          <div className="grid sm:grid-cols-2 gap-2">
            {JOBS.map((j) => {
              const on = j.key === jobKey;
              return (
                <button
                  key={j.key}
                  type="button"
                  onClick={() => selectJob(j.key)}
                  className={[
                    "text-left px-4 py-3 border font-sans text-[14px] font-semibold transition-colors",
                    on
                      ? "border-[#071018] bg-[#071018] text-white"
                      : "border-[#e4e8ec] bg-white text-[#071018] hover:border-[#071018]",
                  ].join(" ")}
                >
                  {j.label}
                </button>
              );
            })}
          </div>
        </ToolPanel>

        <ToolPanel title="Size">
          <RangeField
            label={activeJob.unit}
            value={size}
            min={activeJob.minSize}
            max={activeJob.maxSize}
            step={activeJob.step}
            onChange={setSize}
            display={`${size} ${activeJob.unit}`}
          />
          <p className="font-sans text-[13.5px] leading-[1.6] text-[#5a6a78]">
            Rough Australian residential ranges only. Finish level, access, and site conditions move the number a lot.
          </p>
        </ToolPanel>
      </div>

      <div className="lg:col-span-5 lg:sticky lg:top-6">
        <ToolPanel title="Ballpark range">
          <p className="font-sans text-[14px] text-[#5a6a78] mb-2">{activeJob.label}</p>
          <p className="font-display text-[clamp(1.8rem,3vw,2.4rem)] tracking-wide text-[#b88400] mb-6">
            {moneyAud(range.low)} – {moneyAud(range.high)}
          </p>
          <dl>
            <ToolResultRow label="Low end" value={moneyAud(range.low)} />
            <ToolResultRow label="Mid estimate" value={moneyAud(range.mid)} />
            <ToolResultRow label="High end" value={moneyAud(range.high)} />
          </dl>
          <p className="font-sans text-[13px] leading-[1.6] text-[#5a6a78] mt-5">
            Not a quote. For a firm price, talk to a local tradie who has seen the job.
          </p>
        </ToolPanel>
      </div>
    </div>
  );
}
