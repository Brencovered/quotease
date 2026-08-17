"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { ToolPanel } from "@/components/marketing/tools/ToolShell";

const CHECKS = [
  {
    id: "licence",
    title: "Valid trade licence",
    body: "Ask for their licence number and check it on your state regulator site before work starts.",
  },
  {
    id: "insurance",
    title: "Current insurance",
    body: "Public liability (and workers cover if they have staff). Get a certificate of currency, not a verbal yes.",
  },
  {
    id: "references",
    title: "Recent references or reviews",
    body: "Google reviews help. Also ask for a recent local job you can call or look at.",
  },
  {
    id: "quote",
    title: "Clear written quote",
    body: "Scope, inclusions, exclusions, timeframe, and payment schedule in writing. No handshake-only numbers.",
  },
  {
    id: "timeline",
    title: "Agreed start and finish",
    body: "Confirm when they can start, roughly how long it takes, and what happens if materials are delayed.",
  },
] as const;

export default function HireChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  const progress = useMemo(() => {
    const count = CHECKS.filter((c) => done[c.id]).length;
    return { count, total: CHECKS.length, pct: Math.round((count / CHECKS.length) * 100) };
  }, [done]);

  function toggle(id: string) {
    setDone((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div className="lg:col-span-8 space-y-3">
        {CHECKS.map((item, i) => {
          const on = !!done[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className={[
                "w-full text-left border p-5 sm:p-6 transition-colors",
                on ? "border-[#071018] bg-white" : "border-[#e4e8ec] bg-white hover:border-[#071018]/40",
              ].join(" ")}
            >
              <div className="flex items-start gap-4">
                <span
                  className={[
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                    on ? "bg-[#ffb400] border-[#ffb400]" : "border-[#c5ced6] bg-[#fafbfc]",
                  ].join(" ")}
                >
                  {on ? <Check size={15} className="text-[#071018]" aria-hidden /> : (
                    <span className="font-sans text-[11px] font-bold text-[#8b96a1]">{i + 1}</span>
                  )}
                </span>
                <span>
                  <span className="block font-sans font-bold text-[16px] text-[#071018] mb-1.5">
                    {item.title}
                  </span>
                  <span className="block font-sans text-[14.5px] leading-[1.65] text-[#3d4a55]">
                    {item.body}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="lg:col-span-4 lg:sticky lg:top-6">
        <ToolPanel title="Your progress">
          <p className="font-display text-[2.6rem] tracking-wide text-[#b88400] mb-2">
            {progress.count}/{progress.total}
          </p>
          <div className="h-2 bg-[#eef0f3] mb-4">
            <div
              className="h-full bg-[#ffb400] transition-all"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className="font-sans text-[14px] leading-[1.65] text-[#5a6a78]">
            {progress.count === progress.total
              ? "Nice. You have covered the basics before you hire."
              : "Tap each item as you confirm it. Skip nothing that protects your money and your home."}
          </p>
        </ToolPanel>
      </div>
    </div>
  );
}
