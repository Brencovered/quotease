"use client";

import { useEffect, useMemo, useState, startTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { RotateCcw, Send, Sparkles } from "lucide-react";

type Spot = {
  id: string;
  label: string;
  price: number;
  /** percent positions on the floor plan */
  x: number;
  y: number;
};

type TradeKey = "electrician" | "carpenter" | "plumber" | "roofer";

type TradeConfig = {
  key: TradeKey;
  label: string;
  labourRate: number;
  tools: string[];
  activeTool: string;
  hint: string;
  spots: Spot[];
};

const TRADES: TradeConfig[] = [
  {
    key: "electrician",
    label: "Electrician",
    labourRate: 110,
    tools: ["Calibrate", "Cable run", "Downlight", "GPO", "Switchboard"],
    activeTool: "Downlight",
    hint: "Tap rooms to price lights, power and runs",
    spots: [
      { id: "e-kit", label: "Kitchen downlights × 6", price: 720, x: 52, y: 48 },
      { id: "e-liv", label: "Living downlights × 8", price: 940, x: 42, y: 58 },
      { id: "e-alf", label: "Alfresco lighting package", price: 680, x: 78, y: 22 },
      { id: "e-cin", label: "Home cinema power + data", price: 540, x: 28, y: 52 },
      { id: "e-sb", label: "Switchboard upgrade", price: 1450, x: 68, y: 62 },
    ],
  },
  {
    key: "carpenter",
    label: "Carpenter",
    labourRate: 95,
    tools: ["Calibrate", "Door", "Robe", "Deck", "Joinery"],
    activeTool: "Joinery",
    hint: "Tap joinery, robes, doors and decking",
    spots: [
      { id: "c-kit", label: "Kitchen island + cabinets", price: 6800, x: 54, y: 46 },
      { id: "c-pan", label: "Walk-in pantry fitout", price: 2100, x: 60, y: 40 },
      { id: "c-robe", label: "Bed 1 dressing + robes", price: 3200, x: 16, y: 72 },
      { id: "c-deck", label: "Alfresco decking package", price: 4500, x: 80, y: 18 },
      { id: "c-door", label: "Internal doors × 8", price: 2400, x: 36, y: 44 },
    ],
  },
  {
    key: "plumber",
    label: "Plumber",
    labourRate: 120,
    tools: ["Calibrate", "Fixture", "Hot water", "Rough-in", "Gas"],
    activeTool: "Fixture",
    hint: "Tap wet areas, fixtures and outdoor water points",
    spots: [
      { id: "p-ens", label: "Ensuite fitout", price: 4200, x: 12, y: 68 },
      { id: "p-bath", label: "Bath 1 fitout", price: 3800, x: 18, y: 28 },
      { id: "p-kit", label: "Kitchen sink + dishwasher", price: 1650, x: 50, y: 48 },
      { id: "p-ldry", label: "Laundry rough-in", price: 980, x: 72, y: 48 },
      { id: "p-bbq", label: "Alfresco BBQ + outdoor shower", price: 2100, x: 82, y: 26 },
    ],
  },
  {
    key: "roofer",
    label: "Roofer",
    labourRate: 105,
    tools: ["Calibrate", "Sheet", "Gutter", "Flashings", "Skylight"],
    activeTool: "Sheet",
    hint: "Tap roof zones, gutters and outdoor covers",
    spots: [
      { id: "r-main", label: "Main roof sheeting", price: 8900, x: 48, y: 42 },
      { id: "r-alf", label: "Alfresco roof cover", price: 3200, x: 76, y: 20 },
      { id: "r-gar", label: "Garage roof + flashings", price: 2400, x: 82, y: 72 },
      { id: "r-gut", label: "Gutters + downpipes", price: 1800, x: 30, y: 36 },
      { id: "r-porch", label: "Entry porch roof", price: 1100, x: 46, y: 78 },
    ],
  },
];

/**
 * Interactive floor-plan markup demo with trade switching.
 * Tap amber pins; labour, materials and total update live.
 */
export default function QuoteTapDemo() {
  const [tradeKey, setTradeKey] = useState<TradeKey>("electrician");
  const [picked, setPicked] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  const trade = TRADES.find((t) => t.key === tradeKey) ?? TRADES[0];

  useEffect(() => {
    setPicked([]);
    setSent(false);
  }, [tradeKey]);

  const selected = useMemo(
    () => trade.spots.filter((s) => picked.includes(s.id)),
    [picked, trade.spots],
  );

  const materials = selected.reduce((sum, s) => sum + s.price, 0);
  const labourHrs = selected.length === 0 ? 0 : Number((1.4 + selected.length * 0.7).toFixed(1));
  const labourCost = Math.round(labourHrs * trade.labourRate);
  const total = materials + labourCost;

  function toggle(id: string) {
    if (sent) return;
    startTransition(() => {
      setPicked((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    });
  }

  function reset() {
    setPicked([]);
    setSent(false);
  }

  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">
          Feel it
        </p>
        <h2 className="text-[clamp(1.9rem,3.6vw,2.8rem)] font-extrabold tracking-[-0.025em] leading-[1.08] text-[#071018] mb-4">
          Pick your trade.
          <br />
          Tap the plan. Price loads.
        </h2>
        <p className="text-[15.5px] text-[#4a5560] leading-[1.65] max-w-[42ch] mb-5">
          Same floor plan, different scope. Switch trade and the markup items change to match how you actually quote.
        </p>

        <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Choose a trade">
          {TRADES.map((t) => {
            const on = t.key === tradeKey;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTradeKey(t.key)}
                className={[
                  "px-3.5 py-2 rounded-lg text-[13px] font-extrabold border transition-colors",
                  on
                    ? "bg-[#071018] border-[#071018] text-white"
                    : "bg-white border-[#d5dbe0] text-[#5a6a78] hover:border-[#071018] hover:text-[#071018]",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <ul className="space-y-2 mb-7">
          {trade.spots.map((spot) => {
            const on = picked.includes(spot.id);
            return (
              <li key={spot.id} className="flex items-center gap-2.5 text-[13.5px]">
                <span
                  className={[
                    "w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0",
                    on ? "bg-[#ffb400] text-[#071018]" : "bg-[#e8ecef] text-[#8b96a1]",
                  ].join(" ")}
                >
                  {on ? picked.indexOf(spot.id) + 1 : "·"}
                </span>
                <span className={on ? "font-bold text-[#071018]" : "text-[#5a6a78]"}>
                  {spot.label}
                </span>
              </li>
            );
          })}
        </ul>
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[#071018] hover:text-[#c48a00] transition-colors"
        >
          Start free trial <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="max-w-[420px] w-full mx-auto">
        <div className="rounded-[28px] bg-[#0a121a] p-2.5 shadow-[0_28px_60px_rgba(7,16,24,0.28)] border border-black/40">
          <div className="rounded-[22px] overflow-hidden bg-[#f2f4f6]">
            <div className="bg-[#071018] px-4 pt-3 pb-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-[13px] tracking-wide text-white">SWIFTSCOPE</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#ffb400]">
                  <Sparkles size={11} aria-hidden /> {trade.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Labour</p>
                  <p className="text-[13px] font-bold text-white tabular-nums">{labourHrs}h</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Materials</p>
                  <p className="text-[13px] font-bold text-white tabular-nums">
                    ${materials.toLocaleString("en-AU")}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Total</p>
                  <p className="text-[15px] font-black text-[#ffb400] tabular-nums">
                    ${total.toLocaleString("en-AU")}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-3 pt-3 flex flex-wrap gap-1.5">
              {trade.tools.map((tool) => (
                <span
                  key={tool}
                  className={[
                    "text-[10px] font-bold px-2.5 py-1 rounded-full border",
                    tool === trade.activeTool
                      ? "bg-[#ffb400] border-[#ffb400] text-[#071018]"
                      : "bg-white border-[#d5dbe0] text-[#5a6a78]",
                  ].join(" ")}
                >
                  {tool}
                </span>
              ))}
            </div>
            <p className="px-3 pt-2 text-[11px] font-semibold text-[#8b96a1]">{trade.hint}</p>

            <div className="relative mx-3 mt-2 mb-3 aspect-[16/11] rounded-xl overflow-hidden border border-[#d5dbe0] bg-white">
              <Image
                src="/marketing/v2/demo-floorplan.png"
                alt="Residential floor plan for live markup demo"
                fill
                sizes="420px"
                quality={90}
                className="object-cover object-center"
              />
              {trade.spots.map((spot) => {
                const on = picked.includes(spot.id);
                const n = picked.indexOf(spot.id) + 1;
                return (
                  <button
                    key={spot.id}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${on ? "Remove" : "Add"} ${spot.label}`}
                    disabled={sent}
                    onClick={() => toggle(spot.id)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group z-10"
                    style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                  >
                    <span
                      className={[
                        "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full text-[12px] sm:text-[13px] font-black shadow-[0_6px_16px_rgba(0,0,0,0.28)] transition-transform duration-200",
                        on
                          ? "bg-[#ffb400] text-[#071018] scale-110"
                          : "bg-white text-[#071018] border-2 border-[#ffb400] group-hover:scale-105",
                        sent ? "opacity-80" : "",
                      ].join(" ")}
                    >
                      {on ? n : "+"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="px-3 pb-3 space-y-2">
              {sent ? (
                <div className="flex items-center justify-center gap-2 bg-[#e8f5ec] text-[#1c7a3a] font-extrabold text-[13.5px] py-3.5 rounded-xl">
                  Quote sent. Client notified.
                </div>
              ) : (
                <button
                  type="button"
                  disabled={picked.length === 0}
                  onClick={() => picked.length > 0 && setSent(true)}
                  className={[
                    "w-full flex items-center justify-center gap-2 font-extrabold text-[14px] py-3.5 rounded-xl transition-colors",
                    picked.length === 0
                      ? "bg-[#e2e5ea] text-[#a8b4bd]"
                      : "bg-[#ffb400] text-[#071018] hover:bg-[#e89e00]",
                  ].join(" ")}
                >
                  <Send size={14} aria-hidden /> Send {trade.label.toLowerCase()} quote
                </button>
              )}
              {(picked.length > 0 || sent) && (
                <button
                  type="button"
                  onClick={reset}
                  className="w-full flex items-center justify-center gap-1.5 text-[12px] font-bold text-[#8b96a1] hover:text-[#071018]"
                >
                  <RotateCcw size={11} aria-hidden /> Reset plan
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
