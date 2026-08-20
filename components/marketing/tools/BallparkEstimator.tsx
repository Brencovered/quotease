"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LEADS_ENABLED } from "@/lib/featureFlags";
import {
  moneyAud,
  RangeField,
  SourceInline,
  ToolPanel,
  ToolResultRow,
  ToolToggle,
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

type Finish = "budget" | "mid" | "luxury";

type ExtraKey =
  | "asbestos"
  | "structural"
  | "plumbing-relocate"
  | "waterproofing"
  | "switchboard"
  | "skip";

type ExtraDef = {
  key: ExtraKey;
  label: string;
  hint: string;
  low: number;
  high: number;
  jobs: JobKey[] | "all";
};

const FINISHES: { id: Finish; label: string; mult: number; note: string }[] = [
  {
    id: "budget",
    label: "Budget",
    mult: 0.65,
    note: "Guideline: cosmetic / budget bathroom updates often sit around $8,000-$15,000 when plumbing stays put",
  },
  {
    id: "mid",
    label: "Mid-range",
    mult: 1,
    note: "Guideline: mid-range overhauls commonly land around $15,000-$25,000 depending on size and plumbing moves",
  },
  {
    id: "luxury",
    label: "Luxury",
    mult: 1.45,
    note: "Guideline: high-end finishes and ensuite-style work often push $25,000-$35,000+",
  },
];

const EXTRAS: ExtraDef[] = [
  {
    key: "asbestos",
    label: "Asbestos removal",
    hint: "Common in older wet areas and eaves",
    low: 2500,
    high: 5500,
    jobs: ["bathroom", "kitchen", "roof", "paint-interior", "rewire"],
  },
  {
    key: "structural",
    label: "Structural timber repairs",
    hint: "Rot, termite, or framing surprises",
    low: 3000,
    high: 8000,
    jobs: ["bathroom", "kitchen", "deck", "roof", "fence"],
  },
  {
    key: "plumbing-relocate",
    label: "Plumbing relocation",
    hint: "Moving toilet, vanity, or shower rough-in",
    low: 2000,
    high: 4500,
    jobs: ["bathroom", "kitchen"],
  },
  {
    key: "waterproofing",
    label: "Full waterproofing redo",
    hint: "Membrane failure or non-compliant wet area",
    low: 1800,
    high: 4200,
    jobs: ["bathroom"],
  },
  {
    key: "switchboard",
    label: "Switchboard upgrade",
    hint: "Often needed with rewires and large AC installs",
    low: 1500,
    high: 3500,
    jobs: ["rewire", "split-ac", "kitchen"],
  },
  {
    key: "skip",
    label: "Skip / rubbish removal",
    hint: "Demo waste and site clean-up",
    low: 450,
    high: 1200,
    jobs: "all",
  },
];

const JOBS: {
  key: JobKey;
  label: string;
  sizeLabel: string;
  unit: string;
  minSize: number;
  maxSize: number;
  step: number;
  defaultSize: number;
  /** Mid-range AUD per size unit */
  lowPer: number;
  highPer: number;
  /** Mid-range base for a typical job before size scaling */
  baseLow: number;
  baseHigh: number;
  blurb: string;
  directoryTrade: string;
}[] = [
  {
    key: "bathroom",
    label: "Bathroom overhaul",
    sizeLabel: "Room footprint",
    unit: "m²",
    minSize: 3,
    maxSize: 12,
    step: 0.5,
    defaultSize: 6,
    lowPer: 1500,
    highPer: 2500,
    baseLow: 6000,
    baseHigh: 10000,
    blurb:
      "Guideline only. hipages bathroom benchmarks often cite budget updates around $8,000-$15,000 (no plumbing moves), mid-range overhauls around $15,000-$25,000, and high-end / ensuite work $25,000-$35,000+.",
    directoryTrade: "Bathroom Renovation",
  },
  {
    key: "kitchen",
    label: "Kitchen renovation",
    sizeLabel: "Room footprint",
    unit: "m²",
    minSize: 6,
    maxSize: 25,
    step: 1,
    defaultSize: 12,
    lowPer: 1100,
    highPer: 2100,
    baseLow: 12000,
    baseHigh: 20000,
    blurb: "Cabinetry quality and appliance package drive most of the spread.",
    directoryTrade: "Kitchen Renovation",
  },
  {
    key: "split-ac",
    label: "Split system AC",
    sizeLabel: "Unit capacity",
    unit: "kW",
    minSize: 2.5,
    maxSize: 8,
    step: 0.5,
    defaultSize: 3.5,
    lowPer: 420,
    highPer: 720,
    baseLow: 1800,
    baseHigh: 2800,
    blurb: "Includes typical wall-mounted split supply and install; multi-head and ducted sit higher.",
    directoryTrade: "Air Conditioning",
  },
  {
    key: "rewire",
    label: "Full rewire",
    sizeLabel: "House footprint",
    unit: "m²",
    minSize: 80,
    maxSize: 320,
    step: 10,
    defaultSize: 160,
    lowPer: 45,
    highPer: 85,
    baseLow: 6000,
    baseHigh: 10000,
    blurb: "Partial circuit upgrades cost less; full house rewires scale with floor area and switchboard work.",
    directoryTrade: "Electrician",
  },
  {
    key: "fence",
    label: "Boundary fence",
    sizeLabel: "Fence length",
    unit: "m",
    minSize: 10,
    maxSize: 60,
    step: 1,
    defaultSize: 25,
    lowPer: 85,
    highPer: 175,
    baseLow: 700,
    baseHigh: 1400,
    blurb: "Colorbond vs timber and shared-boundary agreements change the price quickly.",
    directoryTrade: "Fencing",
  },
  {
    key: "roof",
    label: "Re-roof (metal)",
    sizeLabel: "Roof area",
    unit: "m²",
    minSize: 80,
    maxSize: 280,
    step: 5,
    defaultSize: 150,
    lowPer: 65,
    highPer: 125,
    baseLow: 2500,
    baseHigh: 5000,
    blurb: "Pitch, access, insulation, and fascia/gutter replacement sit on top of sheet supply.",
    directoryTrade: "Roofing",
  },
  {
    key: "paint-interior",
    label: "Interior house paint",
    sizeLabel: "Floor footprint",
    unit: "m²",
    minSize: 40,
    maxSize: 280,
    step: 10,
    defaultSize: 120,
    lowPer: 18,
    highPer: 38,
    baseLow: 800,
    baseHigh: 1600,
    blurb: "Prep quality (filling, sanding, ceiling inclusion) moves DIY vs pro numbers a lot.",
    directoryTrade: "Painter",
  },
  {
    key: "deck",
    label: "Timber deck",
    sizeLabel: "Deck footprint",
    unit: "m²",
    minSize: 8,
    maxSize: 50,
    step: 1,
    defaultSize: 20,
    lowPer: 260,
    highPer: 500,
    baseLow: 1800,
    baseHigh: 3500,
    blurb: "Hardwood vs treated pine, handrails, and stairs are the main cost levers.",
    directoryTrade: "Carpenter",
  },
];

export default function BallparkEstimator() {
  const [jobKey, setJobKey] = useState<JobKey>("bathroom");
  const activeJob = JOBS.find((j) => j.key === jobKey) ?? JOBS[0];
  const [size, setSize] = useState(activeJob.defaultSize);
  const [finish, setFinish] = useState<Finish>("mid");
  const [extras, setExtras] = useState<Partial<Record<ExtraKey, boolean>>>({});

  const finishMeta = FINISHES.find((f) => f.id === finish) ?? FINISHES[1];
  const availableExtras = EXTRAS.filter(
    (e) => e.jobs === "all" || e.jobs.includes(jobKey),
  );

  const range = useMemo(() => {
    const mult = finishMeta.mult;
    let low = (activeJob.baseLow + activeJob.lowPer * size) * mult;
    let high = (activeJob.baseHigh + activeJob.highPer * size) * mult;

    for (const extra of EXTRAS) {
      if (!(extra.jobs === "all" || extra.jobs.includes(activeJob.key))) continue;
      if (!extras[extra.key]) continue;
      low += extra.low;
      high += extra.high;
    }

    return { low, high, mid: (low + high) / 2 };
  }, [activeJob, size, finishMeta.mult, extras]);

  function selectJob(key: JobKey) {
    const next = JOBS.find((j) => j.key === key) ?? JOBS[0];
    setJobKey(key);
    setSize(next.defaultSize);
    setExtras({});
  }

  function toggleExtra(key: ExtraKey) {
    setExtras((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const directoryHref = `/directory?trade=${encodeURIComponent(activeJob.directoryTrade)}`;
  const conversionHref = LEADS_ENABLED ? "/get-quotes" : directoryHref;
  const conversionCta = LEADS_ENABLED
    ? "Request quotes from local tradies"
    : "Find local tradies near you";
  const conversionCopy = LEADS_ENABLED
    ? "This estimate reflects local Australian trade averages. Want an exact price tailored to your space? Request quotes from up to 3 local, verified tradies."
    : "This estimate reflects local Australian trade averages. Want an exact price tailored to your space? Browse local, verified tradies and contact them direct.";

  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div className="lg:col-span-7 space-y-6">
        <ToolPanel title="Project type">
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
          <p className="font-sans text-[13.5px] leading-[1.6] text-[#5a6a78] mt-4">
            {activeJob.blurb}{" "}
            {jobKey === "bathroom" ? (
              <>
                See the{" "}
                <SourceInline href="https://hipages.com.au/article/how_much_does_bathroom_renovation_cost">
                  hipages Bathroom Renovation Cost Guide
                </SourceInline>
                .
              </>
            ) : (
              <>
                Cross-check whole-home trade baselines in the{" "}
                <SourceInline href="https://hipages.com.au/article/renovation_guide_how_much_does_it_cost_to_renovate">
                  hipages Home Renovation Cost Guide
                </SourceInline>
                .
              </>
            )}
          </p>
        </ToolPanel>

        <ToolPanel title="Finish quality">
          <ToolToggle
            options={FINISHES.map((f) => ({ id: f.id, label: f.label }))}
            value={finish}
            onChange={(id) => setFinish(id as Finish)}
          />
          <p className="font-sans text-[13.5px] leading-[1.6] text-[#5a6a78]">
            {finishMeta.note}. This is a planning guideline, not a quote.
          </p>
        </ToolPanel>

        <ToolPanel title={activeJob.sizeLabel}>
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
            Guideline ranges only. Access, council requirements, and brand of fittings move real quotes.
          </p>
        </ToolPanel>

        <ToolPanel title="Common hidden extras">
          <p className="font-sans text-[13.5px] leading-[1.6] text-[#5a6a78] mb-4">
            Optional add-ons that often appear after demolition or a site inspection.
          </p>
          <ul className="space-y-3">
            {availableExtras.map((extra) => {
              const on = Boolean(extras[extra.key]);
              return (
                <li key={extra.key}>
                  <label
                    className={[
                      "flex items-start gap-3 border px-4 py-3 cursor-pointer transition-colors",
                      on ? "border-[#071018] bg-[#f7f8f9]" : "border-[#e4e8ec] bg-white hover:border-[#071018]/50",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleExtra(extra.key)}
                      className="mt-1 accent-[#ffb400] shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block font-sans text-[14px] font-semibold text-[#071018]">
                        {extra.label}
                      </span>
                      <span className="block font-sans text-[13px] text-[#5a6a78] mt-0.5">
                        {extra.hint} · typically {moneyAud(extra.low)}-{moneyAud(extra.high)}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </ToolPanel>
      </div>

      <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
        <ToolPanel title="Ballpark range">
          <p className="font-sans text-[14px] text-[#5a6a78] mb-1">
            {activeJob.label} · {finishMeta.label} · {size} {activeJob.unit}
          </p>
          <p className="font-display text-[clamp(1.8rem,3vw,2.4rem)] tracking-wide text-[#b88400] mb-6">
            {moneyAud(range.low)} - {moneyAud(range.high)}
          </p>
          <dl>
            <ToolResultRow label="Low end" value={moneyAud(range.low)} />
            <ToolResultRow label="Mid estimate" value={moneyAud(range.mid)} />
            <ToolResultRow label="High end" value={moneyAud(range.high)} />
          </dl>
          <p className="font-sans text-[13px] leading-[1.6] text-[#5a6a78] mt-5">
            Guideline only - not a quote or renovation advice. Ranges reflect Australian residential
            averages and move with suburb, access, and site conditions. Verify with local tradies and
            the linked cost guides below.
          </p>
        </ToolPanel>

        <aside className="border border-[#e4e8ec] bg-white p-5 sm:p-6">
          <p className="font-sans text-[14.5px] leading-[1.65] text-[#3d4a55] mb-4">
            {conversionCopy}
          </p>
          <Link
            href={conversionHref}
            className="inline-flex items-center gap-2 font-sans text-[14px] font-extrabold text-[#071018] hover:text-[#b88400] transition-colors"
          >
            {conversionCta} <ArrowRight size={14} aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  );
}
