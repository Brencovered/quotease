"use client";

import { useState, startTransition } from "react";
import Link from "next/link";
import { Check, Plus, Send, RotateCcw } from "lucide-react";

type Item = { id: string; label: string; price: number };

const POOL: Item[] = [
  { id: "dl", label: "Downlights × 8", price: 940 },
  { id: "sb", label: "Switchboard upgrade", price: 1450 },
  { id: "pp", label: "Power points × 6", price: 390 },
  { id: "fan", label: "Ceiling fans × 2", price: 480 },
];

/**
 * Compact interactive proof — tap lines into a live total.
 * Kept short so it earns its place after the photo bands, not as the whole page.
 */
export default function QuoteTapDemo() {
  const [picked, setPicked] = useState<Item[]>([]);
  const [sent, setSent] = useState(false);
  const total = picked.reduce((s, i) => s + i.price, 0);
  const ids = new Set(picked.map((p) => p.id));

  function add(item: Item) {
    if (sent || ids.has(item.id)) return;
    startTransition(() => setPicked((prev) => [...prev, item]));
  }

  function reset() {
    setPicked([]);
    setSent(false);
  }

  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">Feel it</p>
        <h2 className="text-[clamp(1.9rem,3.6vw,2.8rem)] font-extrabold tracking-[-0.025em] leading-[1.08] text-[#071018] mb-4">
          Tap the work.<br />Watch the total move.
        </h2>
        <p className="text-[15.5px] text-[#4a5560] leading-[1.65] max-w-[40ch] mb-7">
          On site you&apos;d tap the photo or talk it through. Here, tap a line and see how fast a priced quote appears.
        </p>
        <div className="flex flex-wrap gap-2">
          {POOL.map((item) => {
            const on = ids.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={on || sent}
                onClick={() => add(item)}
                className={[
                  "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13.5px] font-bold border transition-colors",
                  on || sent
                    ? "border-[#e2e5ea] bg-[#f4f6f8] text-[#a8b4bd]"
                    : "border-[#071018] text-[#071018] hover:bg-[#071018] hover:text-white",
                ].join(" ")}
              >
                {on ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-[#071018] rounded-2xl overflow-hidden max-w-[400px] w-full mx-auto shadow-[0_24px_50px_rgba(7,16,24,0.25)]">
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10">
          <span className="font-display text-[15px] text-white tracking-wide">SWIFTSCOPE</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/45">
            {sent ? "Sent" : "Live"}
          </span>
        </div>
        <div className="px-5 py-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/45 mb-1">Total</p>
            <p className="text-[2rem] font-black text-[#ffb400] tabular-nums leading-none">${total.toLocaleString("en-AU")}</p>
          </div>
          <p className="text-[12px] text-white/45 pb-1">{picked.length} items</p>
        </div>
        <div className="bg-white min-h-[180px] px-4 py-3">
          {picked.length === 0 ? (
            <p className="h-[150px] flex items-center justify-center text-[13px] text-[#8b96a1] text-center px-6">
              Empty quote — tap a line on the left
            </p>
          ) : (
            <ul className="space-y-2">
              {picked.map((item) => (
                <li key={item.id} className="flex justify-between bg-[#f4f6f8] rounded-lg px-3 py-2.5 home-line-in">
                  <span className="text-[13px] font-bold text-[#071018]">{item.label}</span>
                  <span className="text-[13px] font-bold tabular-nums">${item.price.toLocaleString("en-AU")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white px-4 pb-4">
          {sent ? (
            <div className="flex items-center justify-center gap-2 bg-[#e8f5ec] text-[#1c7a3a] font-extrabold text-[13.5px] py-3.5 rounded-lg">
              <Check size={15} aria-hidden /> Client notified
            </div>
          ) : (
            <button
              type="button"
              disabled={picked.length === 0}
              onClick={() => picked.length > 0 && setSent(true)}
              className={[
                "w-full flex items-center justify-center gap-2 font-extrabold text-[14px] py-3.5 rounded-lg transition-colors",
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
              className="w-full flex items-center justify-center gap-1.5 mt-2.5 text-[12px] font-bold text-[#8b96a1] hover:text-[#071018]"
            >
              <RotateCcw size={11} aria-hidden /> Reset
            </button>
          )}
        </div>
        <div className="px-5 py-3 border-t border-white/10">
          <Link href="/signup" className="text-[12.5px] font-bold text-[#ffb400] hover:underline">
            Start free trial →
          </Link>
        </div>
      </div>
    </div>
  );
}
