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

const MATRIX_MARGINS = [10, 15, 20, 25, 30, 35, 40, 50];

export default function MarginMarkupCalculator() {
  const [mode, setMode] = useState<"margin" | "markup">("margin");
  const [cost, setCost] = useState(1000);
  const [pct, setPct] = useState(20);
  const [includeGst, setIncludeGst] = useState(true);

  const result = useMemo(() => {
    const p = Math.min(Math.max(pct, 0), 90) / 100;
    let exGst: number;
    let marginPct: number;
    let markupPct: number;

    if (mode === "margin") {
      exGst = p >= 1 ? cost : cost / (1 - p);
      marginPct = pct;
      markupPct = cost > 0 ? ((exGst - cost) / cost) * 100 : 0;
    } else {
      exGst = cost * (1 + p);
      markupPct = pct;
      marginPct = exGst > 0 ? ((exGst - cost) / exGst) * 100 : 0;
    }

    const gst = includeGst ? exGst * 0.1 : 0;
    const incGst = exGst + gst;
    const profit = exGst - cost;

    // Classic trap: treating a target margin % as markup
    const wrongAsMarkup = cost * (1 + (mode === "margin" ? pct : marginPct) / 100);
    const undercharge = mode === "margin" ? Math.max(exGst - wrongAsMarkup, 0) : 0;

    return { exGst, gst, incGst, profit, marginPct, markupPct, wrongAsMarkup, undercharge };
  }, [mode, cost, pct, includeGst]);

  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div className="lg:col-span-6 space-y-6">
        <ToolPanel title="Converter">
          <ToolToggle
            value={mode}
            onChange={(id) => setMode(id as "margin" | "markup")}
            options={[
              { id: "margin", label: "Target margin %" },
              { id: "markup", label: "Target markup %" },
            ]}
          />
          <NumberField
            label="Materials cost (ex GST)"
            value={cost}
            onChange={setCost}
            prefix="$"
            min={0}
            step={1}
          />
          <RangeField
            label={mode === "margin" ? "Desired profit margin" : "Desired markup on cost"}
            value={pct}
            min={5}
            max={60}
            step={1}
            onChange={setPct}
            display={`${pct}%`}
          />
          <ToolToggle
            value={includeGst ? "gst" : "ex"}
            onChange={(id) => setIncludeGst(id === "gst")}
            options={[
              { id: "gst", label: "Show price + 10% GST" },
              { id: "ex", label: "Ex GST only" },
            ]}
          />
          <p className="font-sans text-[13.5px] leading-[1.6] text-[#5a6a78]">
            A 20% markup on $1,000 is $1,200, but that is only a 16.7% margin. Mixing them up leaks profit on every job.
          </p>
        </ToolPanel>

        <ToolPanel title="What to quote the customer">
          <dl>
            <ToolResultRow
              label={includeGst ? "Sell price (inc GST)" : "Sell price (ex GST)"}
              value={moneyAud(includeGst ? result.incGst : result.exGst, 2)}
              highlight
            />
            <ToolResultRow label="Sell price ex GST" value={moneyAud(result.exGst, 2)} />
            {includeGst ? (
              <ToolResultRow label="GST (10%)" value={moneyAud(result.gst, 2)} />
            ) : null}
            <ToolResultRow label="Your profit (ex GST)" value={moneyAud(result.profit, 2)} />
            <ToolResultRow label="True margin" value={`${result.marginPct.toFixed(1)}%`} />
            <ToolResultRow label="True markup" value={`${result.markupPct.toFixed(1)}%`} />
          </dl>
        </ToolPanel>

        {mode === "margin" ? (
          <ToolPanel title="If you treat margin as markup">
            <dl>
              <ToolResultRow label="Wrong sell price" value={moneyAud(result.wrongAsMarkup, 2)} />
              <ToolResultRow
                label="You undercharge by"
                value={moneyAud(result.undercharge, 2)}
                highlight
              />
            </dl>
          </ToolPanel>
        ) : null}
      </div>

      <div className="lg:col-span-6">
        <ToolPanel title="Margin ↔ markup matrix">
          <p className="font-sans text-[13.5px] leading-[1.6] text-[#5a6a78] mb-5">
            Quick reference: the markup you need on cost to hit a target margin on sell price.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] border-collapse">
              <thead>
                <tr className="border-b border-[#e4e8ec]">
                  <th className="py-2.5 pr-3 text-left font-sans text-[12px] font-bold uppercase tracking-wider text-[#8b96a1]">
                    Margin
                  </th>
                  <th className="py-2.5 px-3 text-left font-sans text-[12px] font-bold uppercase tracking-wider text-[#8b96a1]">
                    Markup needed
                  </th>
                  <th className="py-2.5 pl-3 text-right font-sans text-[12px] font-bold uppercase tracking-wider text-[#8b96a1]">
                    On your cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {MATRIX_MARGINS.map((m) => {
                  const markup = (m / (100 - m)) * 100;
                  const sell = cost / (1 - m / 100);
                  const active = mode === "margin" && pct === m;
                  return (
                    <tr
                      key={m}
                      className={[
                        "border-b border-[#eef0f3]",
                        active ? "bg-[#fff8e6]" : "",
                      ].join(" ")}
                    >
                      <td className="py-3 pr-3 font-sans text-[14.5px] font-semibold text-[#071018]">
                        {m}%
                      </td>
                      <td className="py-3 px-3 font-display text-[1.15rem] tracking-wide text-[#b88400]">
                        {markup.toFixed(1)}%
                      </td>
                      <td className="py-3 pl-3 text-right font-sans text-[14px] text-[#3d4a55] tabular-nums">
                        {moneyAud(sell, 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="font-sans text-[12.5px] text-[#8b96a1] mt-4">
            Example: 20% margin needs 25% markup. 30% margin needs about 42.9% markup.
          </p>
        </ToolPanel>
      </div>
    </div>
  );
}
