"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Check, Send, RotateCcw } from "lucide-react";

type LineItem = {
  id: string;
  label: string;
  detail: string;
  price: number;
};

const AVAILABLE_ITEMS: LineItem[] = [
  { id: "downlight", label: "Downlights", detail: "8 each · supply & install", price: 940 },
  { id: "switchboard", label: "Switchboard upgrade", detail: "1 lot", price: 1450 },
  { id: "powerpoint", label: "Double power points", detail: "6 each", price: 390 },
  { id: "ceilingfan", label: "Ceiling fans", detail: "2 each", price: 480 },
  { id: "safety", label: "Safety switches", detail: "2 each", price: 220 },
  { id: "labour", label: "Call-out labour", detail: "1 lot", price: 165 },
];

/**
 * Interactive homepage demo: tap items to watch a quote total build, then
 * "send". Cards are intentional here — they are the interaction surface.
 */
export default function InteractiveQuoteDemo() {
  const [items, setItems] = useState<LineItem[]>([]);
  const [sent, setSent] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [hintPulse, setHintPulse] = useState(true);
  const timeoutRef = useRef<number | null>(null);

  const total = items.reduce((sum, i) => sum + i.price, 0);
  const addedIds = new Set(items.map((i) => i.id));

  useEffect(() => {
    if (items.length > 0) setHintPulse(false);
  }, [items.length]);

  function addItem(item: LineItem) {
    if (sent || addedIds.has(item.id)) return;
    setItems((prev) => [...prev, item]);
    setJustAddedId(item.id);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setJustAddedId(null), 700);
  }

  function removeItem(id: string) {
    if (sent) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function reset() {
    setItems([]);
    setSent(false);
    setHintPulse(true);
  }

  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
      <div>
        <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
          Try it
        </p>
        <h2 className="font-display uppercase text-[2.1rem] sm:text-[2.7rem] leading-[0.95] text-[#0a1722] mb-4">
          Tap a few items.<br />Watch the quote build.
        </h2>
        <p className="text-[15.5px] text-[#4a5560] leading-[1.65] max-w-[440px] mb-8">
          Same idea as on site — mark the work, get a priced total, send it.
          Here you tap the chips; in the app you&apos;d tap the photo or talk it through.
        </p>

        <div className="flex flex-wrap gap-2.5" role="list" aria-label="Add quote items">
          {AVAILABLE_ITEMS.map((item, index) => {
            const added = addedIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => addItem(item)}
                disabled={added || sent}
                className={[
                  "flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-[13.5px] font-bold transition-all duration-200",
                  added || sent
                    ? "border-[#e2e5ea] bg-[#f4f6f8] text-[#a8b4bd] cursor-default"
                    : "border-[#0a1722] bg-white text-[#0a1722] hover:bg-[#0a1722] hover:text-white cursor-pointer",
                  hintPulse && index === 0 && !added
                    ? "home-chip-hint"
                    : "",
                ].join(" ")}
              >
                {added ? <Check size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative lg:sticky lg:top-8">
        <div
          className={[
            "bg-[#0a1722] overflow-hidden max-w-[440px] mx-auto transition-transform duration-500",
            items.length > 0 ? "home-quote-lift" : "",
          ].join(" ")}
          style={{ borderRadius: 20 }}
        >
          <div className="px-6 py-5 flex items-center justify-between">
            <span className="font-display text-[16px] text-white tracking-wide">SWIFTSCOPE</span>
            <span className="text-[10px] font-bold text-[#8aa4b4] uppercase tracking-widest">
              {sent ? "Sent" : "Live quote"}
            </span>
          </div>

          <div className="px-6 pb-5 flex items-end justify-between border-b border-white/10">
            <div>
              <p className="text-[10px] font-bold text-[#8aa4b4] uppercase tracking-widest mb-1">Total</p>
              <p
                key={total}
                className="text-[2.15rem] font-black text-[#ffb400] tabular-nums leading-none home-total-pop"
              >
                ${total.toLocaleString("en-AU")}
              </p>
            </div>
            <p className="text-[12.5px] text-[#8aa4b4] pb-1">
              {items.length} item{items.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="bg-white min-h-[260px] px-5 py-4">
            {items.length === 0 ? (
              <div className="h-[240px] flex flex-col items-center justify-center text-center px-4">
                <p className="text-[14px] font-bold text-[#0a1722] mb-1">Empty quote</p>
                <p className="text-[13px] text-[#8b96a1] max-w-[220px]">
                  Tap an item on the left — it drops in here with the price already on it.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={[
                      "flex items-center justify-between bg-[#f4f6f8] px-4 py-3 home-line-in",
                      justAddedId === item.id ? "ring-2 ring-[#ffb400]" : "",
                    ].join(" ")}
                    style={{ borderRadius: 12 }}
                  >
                    <div>
                      <p className="text-[13.5px] font-bold text-[#0a1722]">{item.label}</p>
                      <p className="text-[11.5px] text-[#8b96a1]">{item.detail}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-[13.5px] font-bold text-[#0a1722] tabular-nums">
                        ${item.price.toLocaleString("en-AU")}
                      </p>
                      {!sent && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-[11px] text-[#c94040] font-bold hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="px-5 pb-5 pt-2 bg-white">
            {sent ? (
              <div
                className="flex items-center justify-center gap-2 bg-[#e8f5ec] text-[#1c7a3a] font-extrabold text-[14px] py-4 home-sent-in"
                style={{ borderRadius: 12 }}
              >
                <Check size={17} aria-hidden /> Client notified — quote sent
              </div>
            ) : (
              <button
                type="button"
                onClick={() => items.length > 0 && setSent(true)}
                disabled={items.length === 0}
                className={[
                  "w-full flex items-center justify-center gap-2 font-extrabold text-[14.5px] py-4 transition-colors",
                  items.length === 0
                    ? "bg-[#e2e5ea] text-[#a8b4bd] cursor-not-allowed"
                    : "bg-[#ffb400] text-[#0a1722] hover:bg-[#e89e00]",
                ].join(" ")}
                style={{ borderRadius: 12 }}
              >
                <Send size={15} aria-hidden /> Send quote
              </button>
            )}
            {(items.length > 0 || sent) && (
              <button
                type="button"
                onClick={reset}
                className="w-full flex items-center justify-center gap-1.5 text-[12px] font-bold text-[#8b96a1] hover:text-[#0a1722] mt-3 transition-colors"
              >
                <RotateCcw size={12} aria-hidden /> Start again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
