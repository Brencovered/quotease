"use client";

import { useMemo, useState } from "react";
import {
  moneyAud,
  NumberField,
  RangeField,
  ToolPanel,
  ToolResultRow,
} from "@/components/marketing/tools/ToolShell";

export default function MarginMarkupCalculator() {
  const [cost, setCost] = useState(420);
  const [marginPct, setMarginPct] = useState(30);

  const result = useMemo(() => {
    const m = Math.min(Math.max(marginPct, 0), 90) / 100;
    const sellFromMargin = m >= 1 ? cost : cost / (1 - m);
    const markupPct = cost > 0 ? ((sellFromMargin - cost) / cost) * 100 : 0;
    const profit = sellFromMargin - cost;
    // Same sell price if someone wrongly uses margin % as markup
    const wrongSell = cost * (1 + marginPct / 100);
    const undercharge = sellFromMargin - wrongSell;
    return { sellFromMargin, markupPct, profit, wrongSell, undercharge };
  }, [cost, marginPct]);

  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div className="lg:col-span-6 space-y-6">
        <ToolPanel title="Materials">
          <NumberField
            label="Cost price of materials"
            value={cost}
            onChange={setCost}
            prefix="$"
            min={0}
            step={1}
          />
          <RangeField
            label="Desired profit margin"
            value={marginPct}
            min={5}
            max={60}
            step={1}
            onChange={setMarginPct}
            display={`${marginPct}%`}
          />
          <p className="font-sans text-[13.5px] leading-[1.6] text-[#5a6a78]">
            Margin is profit as a percent of the sell price. Markup is profit as a percent of cost. Mixing them up quietly eats your profit.
          </p>
        </ToolPanel>
      </div>

      <div className="lg:col-span-6 space-y-6">
        <ToolPanel title="What to quote">
          <dl>
            <ToolResultRow
              label="Customer price"
              value={moneyAud(result.sellFromMargin, 2)}
              highlight
            />
            <ToolResultRow label="Your profit" value={moneyAud(result.profit, 2)} />
            <ToolResultRow
              label="Equivalent markup"
              value={`${result.markupPct.toFixed(1)}%`}
              hint={`A ${marginPct}% margin equals about ${result.markupPct.toFixed(0)}% markup on cost.`}
            />
          </dl>
        </ToolPanel>

        <ToolPanel title="If you mix them up">
          <dl>
            <ToolResultRow
              label={`Using ${marginPct}% as markup instead`}
              value={moneyAud(result.wrongSell, 2)}
            />
            <ToolResultRow
              label="You would undercharge by"
              value={moneyAud(Math.max(result.undercharge, 0), 2)}
              highlight
            />
          </dl>
        </ToolPanel>
      </div>
    </div>
  );
}
