"use client";

import { useMemo, useState } from "react";
import type { TradeDemoJob } from "@/lib/marketing/trade-hub-engagement";

function moneyAud(n: number) {
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

export default function TradeJobDemo({
  tradeLabel,
  jobs,
}: {
  tradeLabel: string;
  jobs: TradeDemoJob[];
}) {
  const [activeId, setActiveId] = useState(jobs[0]?.id ?? "");
  const active = useMemo(
    () => jobs.find((j) => j.id === activeId) ?? jobs[0],
    [jobs, activeId],
  );

  if (!active) return null;

  const materials = active.lines.reduce((sum, l) => sum + l.amount, 0);
  const total = materials;

  return (
    <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
      <div className="lg:col-span-5">
        <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#b88400] mb-3">
          Common jobs
        </p>
        <h2 className="font-display text-[clamp(1.75rem,3.2vw,2.45rem)] tracking-wide leading-[1.08] text-[#071018] mb-3">
          One-tap estimate previews
        </h2>
        <p className="font-sans text-[16px] leading-[1.65] text-[#5a6a78] max-w-[40ch] mb-8">
          Tap a typical {tradeLabel.toLowerCase()} job. See materials, labour hours, and a
          total assemble in the phone — the speed you get on site.
        </p>
        <div className="flex flex-col gap-2">
          {jobs.map((job) => {
            const on = job.id === active.id;
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => setActiveId(job.id)}
                className={[
                  "text-left px-4 py-3.5 border font-sans text-[15px] font-semibold transition-colors",
                  on
                    ? "border-[#071018] bg-[#071018] text-white"
                    : "border-[#e4e8ec] bg-white text-[#071018] hover:border-[#071018]",
                ].join(" ")}
              >
                {job.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-7">
        <div className="mx-auto w-full max-w-[300px]">
          <div className="relative rounded-[2rem] border-[3px] border-[#1a242c] bg-[#1a242c] p-2 shadow-[0_28px_60px_rgba(26,36,44,0.28)]">
            <div className="rounded-[1.55rem] bg-white overflow-hidden min-h-[520px] flex flex-col">
              <div className="bg-[#1a242c] px-4 pt-3 pb-3">
                <p className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-[#ffb400] mb-1">
                  Swiftscope · quote
                </p>
                <p className="font-display text-[1.25rem] tracking-wide text-white leading-none">
                  {active.label}
                </p>
              </div>

              <div className="px-4 py-3 border-b border-[#e8ecef] flex items-center justify-between gap-3">
                <div>
                  <p className="font-sans text-[11px] text-[#8b96a1]">Typical labour</p>
                  <p className="font-sans text-[15px] font-bold text-[#071018]">
                    {active.labourHours} h
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-sans text-[11px] text-[#8b96a1]">Assemblies</p>
                  <p className="font-sans text-[15px] font-bold text-[#071018]">
                    {active.lines.length} lines
                  </p>
                </div>
              </div>

              <ul className="flex-1 px-4 py-2 overflow-hidden">
                {active.lines.map((line) => (
                  <li
                    key={line.name}
                    className="border-b border-[#f0f2f4] py-2.5 last:border-0 animate-[fadeIn_0.35s_ease]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-sans text-[13.5px] font-semibold text-[#071018] leading-snug">
                          {line.name}
                        </p>
                        <p className="font-sans text-[12px] text-[#8b96a1] mt-0.5">{line.qty}</p>
                      </div>
                      <p className="font-sans text-[13.5px] font-bold text-[#071018] tabular-nums shrink-0">
                        {line.amount > 0 ? moneyAud(line.amount) : "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-auto px-4 py-4 bg-[#f7f8f9] border-t border-[#e8ecef]">
                <div className="flex items-end justify-between gap-3 mb-3">
                  <p className="font-sans text-[12px] font-bold tracking-[0.12em] uppercase text-[#8b96a1]">
                    Quote total
                  </p>
                  <p className="font-display text-[1.85rem] tracking-wide text-[#b88400] leading-none tabular-nums">
                    {moneyAud(total)}
                  </p>
                </div>
                <p className="font-sans text-[12px] text-[#5a6a78] leading-snug">
                  Guideline assembly only — your book and margins set the real number in seconds on
                  site.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
