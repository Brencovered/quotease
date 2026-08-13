"use client";

import { useMemo, useState, startTransition } from "react";
import Link from "next/link";
import { RotateCcw, Send, Sparkles } from "lucide-react";

type Spot = {
  id: string;
  label: string;
  price: number;
  /** percent positions inside the plan stage */
  x: number;
  y: number;
};

const SPOTS: Spot[] = [
  { id: "kit", label: "Kitchen downlights × 4", price: 470, x: 28, y: 38 },
  { id: "liv", label: "Living downlights × 6", price: 705, x: 62, y: 32 },
  { id: "bed", label: "Bedroom points × 3", price: 285, x: 72, y: 58 },
  { id: "run", label: "Cable run, 12m", price: 186, x: 44, y: 70 },
];

/**
 * Interactive floor-plan markup demo: tap amber pins, watch labour/materials/total update.
 */
export default function QuoteTapDemo() {
  const [picked, setPicked] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  const selected = useMemo(
    () => SPOTS.filter((s) => picked.includes(s.id)),
    [picked],
  );

  const materials = selected.reduce((sum, s) => sum + s.price, 0);
  const labourHrs = selected.length === 0 ? 0 : Number((1.2 + selected.length * 0.6).toFixed(1));
  const labourCost = Math.round(labourHrs * 110);
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
          Tap the plan.
          <br />
          Watch the quote write itself.
        </h2>
        <p className="text-[15.5px] text-[#4a5560] leading-[1.65] max-w-[40ch] mb-6">
          Same idea as on site: drop pins on the plan, price loads from your book. Try a few taps.
        </p>
        <ul className="space-y-2 mb-7">
          {SPOTS.map((spot) => {
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

      <div className="max-w-[380px] w-full mx-auto">
        <div className="rounded-[28px] bg-[#0a121a] p-2.5 shadow-[0_28px_60px_rgba(7,16,24,0.28)] border border-black/40">
          <div className="rounded-[22px] overflow-hidden bg-[#f2f4f6]">
            {/* App chrome */}
            <div className="bg-[#071018] px-4 pt-3 pb-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-[13px] tracking-wide text-white">SWIFTSCOPE</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#ffb400]">
                  <Sparkles size={11} aria-hidden /> Live markup
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Labour</p>
                  <p className="text-[13px] font-bold text-white tabular-nums">{labourHrs}h</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Materials</p>
                  <p className="text-[13px] font-bold text-white tabular-nums">${materials.toLocaleString("en-AU")}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Total</p>
                  <p className="text-[15px] font-black text-[#ffb400] tabular-nums">${total.toLocaleString("en-AU")}</p>
                </div>
              </div>
            </div>

            <div className="px-3 pt-3 flex flex-wrap gap-1.5">
              {["Calibrate", "Cable run", "Downlight", "GPO"].map((tool) => (
                <span
                  key={tool}
                  className={[
                    "text-[10px] font-bold px-2.5 py-1 rounded-full border",
                    tool === "Downlight"
                      ? "bg-[#ffb400] border-[#ffb400] text-[#071018]"
                      : "bg-white border-[#d5dbe0] text-[#5a6a78]",
                  ].join(" ")}
                >
                  {tool}
                </span>
              ))}
            </div>
            <p className="px-3 pt-2 text-[11px] font-semibold text-[#8b96a1]">
              Tap a spot on the plan to price it
            </p>

            {/* Plan stage */}
            <div className="relative mx-3 mt-2 mb-3 aspect-[5/4] rounded-xl overflow-hidden border border-[#d5dbe0] bg-[#e9edf1]">
              <div
                className="absolute inset-0 opacity-[0.55]"
                style={{
                  backgroundImage:
                    "linear-gradient(#c5ced6 1px, transparent 1px), linear-gradient(90deg, #c5ced6 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
              <div className="absolute inset-[12%] border-2 border-[#8a97a3]/70 rounded-sm" />
              <div className="absolute left-[12%] top-[12%] w-[38%] h-[40%] border border-[#8a97a3]/55" />
              <div className="absolute right-[12%] top-[12%] w-[38%] h-[28%] border border-[#8a97a3]/55" />
              <div className="absolute left-[12%] bottom-[12%] w-[76%] h-[28%] border border-[#8a97a3]/55" />
              <span className="absolute left-[18%] top-[26%] text-[9px] font-bold tracking-wide text-[#6b7884]">KITCHEN</span>
              <span className="absolute right-[20%] top-[20%] text-[9px] font-bold tracking-wide text-[#6b7884]">LIVING</span>
              <span className="absolute left-[40%] bottom-[20%] text-[9px] font-bold tracking-wide text-[#6b7884]">BED 1</span>

              {SPOTS.map((spot) => {
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
                    className="absolute -translate-x-1/2 -translate-y-1/2 group"
                    style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                  >
                    <span
                      className={[
                        "flex items-center justify-center w-9 h-9 rounded-full text-[13px] font-black shadow-md transition-transform duration-200",
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
                  <Send size={14} aria-hidden /> Send quote
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
