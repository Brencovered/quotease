"use client";

import { useMemo, useState } from "react";
import type { DocketLine } from "@/lib/marketing/tradePages";

/**
 * QuoteItUp
 * ---------
 * The visual on the trade pages. It is not a visual: it is a thing you use.
 *
 * Three static attempts came before this and all three failed for the same
 * reason. A screenshot, a quote document and a marked-up plan are each a
 * picture of a thing. They sit there. The product is not a thing, it is a
 * transformation: a mess on site becomes a priced quote in about two minutes.
 * A still frame of either end cannot show a transformation, which is why none
 * of them read as engaging however well they were cropped or drawn.
 *
 * So the visitor performs it. Tap what is on the job, watch the quote build
 * and the total move. That is what a tradie does all day, it takes about
 * eight seconds, and it proves the trade-specific claim in a way no caption
 * can: the chips on the sparky page say RCBO poles and cable runs, the ones
 * on the roofer page say ridge and valley by the linear metre. You cannot
 * fake that with a stock image.
 *
 * Why it also solves the practical problems that dogged the screenshots:
 *  - No image request, and nothing to crop, cap or overflow.
 *  - Legible at every width, because it is text and numbers.
 *  - On mobile it is roughly 420px of tappable interface rather than a 650px
 *    static block, and tapping is the native mobile interaction.
 *
 * Data comes from the trade's own docket lines, so there is no second content
 * source to keep in sync. Precedent for an interactive marketing element is
 * already set by SavingsCalculator on the homepage.
 */
export default function QuoteItUp({
  lines,
  labourHours,
  hourlyRate = 95,
}: {
  lines: DocketLine[];
  labourHours: number;
  hourlyRate?: number;
}) {
  // Two preselected so the panel never opens empty, and so the first tap is
  // a change rather than a cold start.
  const [picked, setPicked] = useState<Set<number>>(new Set([0, 1]));

  const toggle = (i: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const chosen = useMemo(() => lines.filter((_, i) => picked.has(i)), [lines, picked]);

  const materials = chosen.reduce((sum, l) => sum + l.amount, 0);
  // Labour scales with how much of the job is selected, so the total responds
  // sensibly rather than jumping by a fixed block.
  const hours = lines.length ? Math.round((labourHours * chosen.length) / lines.length) : 0;
  const labour = hours * hourlyRate;
  const total = materials + labour;

  const money = (n: number) =>
    n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

  return (
    <div className="w-full max-w-[560px]">
      <div className="rounded-2xl overflow-hidden border border-[#e8ecef] bg-white shadow-[0_18px_44px_rgba(10,23,34,0.10)]">
        {/* Prompt. Says exactly what to do, in the voice of the product. */}
        <div className="px-5 pt-5 pb-4 border-b border-[#eef1f3]">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ffb400] mb-1.5">
            Try it
          </p>
          <p className="text-[14.5px] font-semibold text-[#0a1722]">Tap what&apos;s on the job.</p>
        </div>

        {/* Chips: the trade's own line items. This is the trade-specific proof. */}
        <div className="px-5 py-4 flex flex-wrap gap-2 border-b border-[#eef1f3]">
          {lines.map((l, i) => {
            const on = picked.has(i);
            return (
              <button
                key={l.label}
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={on}
                className={`group inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb400] focus-visible:ring-offset-2 ${
                  on
                    ? "bg-[#0a1722] border-[#0a1722] text-white"
                    : "bg-white border-[#dfe5ea] text-[#5a6a78] hover:border-[#0a1722] hover:text-[#0a1722]"
                }`}
              >
                <span
                  className={`grid place-items-center h-4 w-4 rounded-full text-[11px] leading-none transition-colors ${
                    on ? "bg-[#ffb400] text-[#0a1722]" : "bg-[#eef1f3] text-[#8a9ba8]"
                  }`}
                  aria-hidden
                >
                  {on ? "\u2713" : "+"}
                </span>
                {l.label}
                <span className={`text-[11.5px] tabular-nums ${on ? "text-[#8aa4b4]" : "text-[#a8b4bf]"}`}>
                  {l.qty} {l.unit}
                </span>
              </button>
            );
          })}
        </div>

        {/* The quote, assembling. */}
        <ul className="min-h-[132px]">
          {chosen.length === 0 && (
            <li className="px-5 py-8 text-[13.5px] text-[#8a9ba8] text-center">
              Nothing on the job yet. Tap an item above.
            </li>
          )}
          {chosen.map((l) => (
            <li
              key={l.label}
              className="qiu-row flex items-baseline gap-3 px-5 py-2.5 border-b border-[#f2f5f7]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-[#0a1722] leading-snug">{l.label}</p>
                <p className="text-[11px] text-[#8a9ba8] tabular-nums mt-0.5">
                  {l.qty} {l.unit}
                </p>
              </div>
              <p className="text-[13px] font-semibold text-[#0a1722] tabular-nums shrink-0">
                {money(l.amount)}
              </p>
            </li>
          ))}
          {chosen.length > 0 && (
            <li className="flex items-baseline gap-3 px-5 py-2.5 bg-[#fafbfc]">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-[#0a1722]">Labour</p>
                <p className="text-[11px] text-[#8a9ba8] tabular-nums mt-0.5">
                  {hours} hrs at ${hourlyRate}
                </p>
              </div>
              <p className="text-[13px] font-semibold text-[#0a1722] tabular-nums shrink-0">
                {money(labour)}
              </p>
            </li>
          )}
        </ul>

        {/* Total. The one loud element, and the thing that moves when you tap. */}
        <div className="px-5 py-4 bg-[#0a1722] flex items-end justify-between gap-4">
          <p className="text-[11.5px] text-[#8aa4b4] leading-relaxed">
            Materials and labour<br />split, always
          </p>
          <div className="text-right">
            <p className="text-[9.5px] font-bold uppercase tracking-[.22em] text-[#8aa4b4]">Quote total</p>
            <p key={total} className="qiu-total font-display text-[2.4rem] leading-none text-[#ffb400] tabular-nums">
              {money(total)}
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[12.5px] leading-[1.55] text-[#8aa4b4]">
        Illustrative figures on your own rates. The items and units are the real ones this builder
        asks for.
      </p>

      {/* Rows slide in as they are added; the total pulses when it changes.
          Keyed on the total so React remounts it and the animation replays.
          Both off under reduced motion. */}
      <style>{`
        .qiu-row { animation: qiu-in .22s ease-out; }
        @keyframes qiu-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        .qiu-total { animation: qiu-pop .28s ease-out; }
        @keyframes qiu-pop { 0% { transform: scale(.94); opacity: .6; } 100% { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .qiu-row, .qiu-total { animation: none; }
        }
      `}</style>
    </div>
  );
}
