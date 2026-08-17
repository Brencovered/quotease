"use client";

import { useState } from "react";
import type { TradeQuoteField } from "@/lib/marketing/trade-hub-engagement";

function moneyAud(n: number) {
  if (!n) return "—";
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

export default function TradeQuoteFieldsInteractive({
  fields,
  dedicated,
}: {
  fields: TradeQuoteField[];
  dedicated: boolean;
}) {
  const [activeId, setActiveId] = useState(fields[0]?.id ?? "");
  const active = fields.find((f) => f.id === activeId) ?? fields[0];

  if (!active) return null;

  return (
    <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
      <div className="lg:col-span-5">
        <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#b88400] mb-3">
          Quote fields
        </p>
        <h2 className="font-display text-[clamp(1.75rem,3.2vw,2.45rem)] tracking-wide leading-[1.08] text-[#071018] mb-4 max-w-[14ch]">
          Built around how you price
        </h2>
        <p className="font-sans text-[16px] leading-[1.7] text-[#3d4a55] max-w-[38ch] mb-8">
          {dedicated
            ? "Dedicated quote flow for this trade. Tap a field to see how it lands in the phone app."
            : "Uses your price book and line items. Tap a field to see how it lands in the phone app."}
        </p>
        <ul className="space-y-2">
          {fields.map((field, i) => {
            const on = field.id === active.id;
            return (
              <li key={field.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(field.id)}
                  className={[
                    "w-full flex items-center gap-4 px-4 py-3.5 border text-left transition-colors",
                    on
                      ? "border-[#071018] bg-[#071018] text-white"
                      : "border-[#e4e8ec] bg-white text-[#071018] hover:border-[#071018]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "font-display text-[1.05rem] tracking-wide tabular-nums w-7 shrink-0",
                      on ? "text-[#ffb400]" : "text-[#ffb400]/90",
                    ].join(" ")}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-sans text-[15.5px] font-semibold">{field.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="lg:col-span-7">
        <div className="mx-auto w-full max-w-[300px]">
          <div className="relative rounded-[2rem] border-[3px] border-[#1a242c] bg-[#1a242c] p-2 shadow-[0_28px_60px_rgba(26,36,44,0.22)]">
            <div className="rounded-[1.55rem] bg-white overflow-hidden min-h-[460px] flex flex-col">
              <div className="bg-[#1a242c] px-4 pt-3 pb-3">
                <p className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-[#ffb400] mb-1">
                  Line items
                </p>
                <p className="font-display text-[1.2rem] tracking-wide text-white leading-none">
                  Quote builder
                </p>
              </div>

              <ul className="flex-1 px-3 py-3 space-y-2">
                {fields.map((field) => {
                  const highlighted = field.id === active.id;
                  return (
                    <li
                      key={field.id}
                      className={[
                        "rounded-lg border px-3 py-2.5 transition-all duration-300",
                        highlighted
                          ? "border-[#ffb400] bg-[#fff8e8] scale-[1.02] shadow-[0_8px_24px_rgba(255,180,0,0.15)]"
                          : "border-[#e8ecef] bg-[#fafbfc] opacity-55",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-sans text-[11px] font-bold tracking-[0.1em] uppercase text-[#b88400] mb-0.5">
                            {field.label}
                          </p>
                          <p className="font-sans text-[13.5px] font-semibold text-[#071018] leading-snug">
                            {field.mockLine}
                          </p>
                          <p className="font-sans text-[12px] text-[#8b96a1] mt-0.5">{field.mockQty}</p>
                        </div>
                        <p className="font-sans text-[13px] font-bold text-[#071018] tabular-nums shrink-0">
                          {moneyAud(field.mockAmount)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="px-4 py-3 border-t border-[#e8ecef] bg-[#f7f8f9]">
                <p className="font-sans text-[12.5px] text-[#5a6a78] leading-snug">
                  Highlighted: <span className="font-semibold text-[#071018]">{active.label}</span> —
                  how that field shows inside Swiftscope.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
