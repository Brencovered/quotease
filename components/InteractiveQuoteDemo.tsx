"use client";

import { useState, useRef } from "react";
import { Plus, Camera, Check, Send, RotateCcw } from "lucide-react";

type LineItem = {
  id: string;
  label: string;
  detail: string;
  price: number;
};

const AVAILABLE_ITEMS: LineItem[] = [
  { id: "downlight", label: "Downlight, standard", detail: "8 each", price: 940 },
  { id: "switchboard", label: "Switchboard upgrade", detail: "1 lot", price: 1450 },
  { id: "powerpoint", label: "Double power point", detail: "6 each", price: 390 },
  { id: "ceilingfan", label: "Ceiling fan install", detail: "2 each", price: 480 },
  { id: "safety", label: "Safety switch", detail: "2 each", price: 220 },
  { id: "labour", label: "Labour - callout", detail: "1 lot", price: 165 },
];

export default function InteractiveQuoteDemo() {
  const [items, setItems] = useState<LineItem[]>([]);
  const [sent, setSent] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = items.reduce((sum, i) => sum + i.price, 0);
  const addedIds = new Set(items.map((i) => i.id));

  function addItem(item: LineItem) {
    if (sent) return;
    setItems((prev) => [...prev, item]);
    setJustAddedId(item.id);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setJustAddedId(null), 900);
  }

  function removeItem(id: string) {
    if (sent) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function reset() {
    setItems([]);
    setSent(false);
  }

  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      {/* Left: pitch + item chips (the "input") */}
      <div>
        <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Try it yourself</p>
        <h2 className="font-display text-[2rem] sm:text-[2.6rem] leading-[0.95] uppercase mb-5 text-[#0a1722]">
          Tap a few items.<br />Watch the quote build.
        </h2>
        <p className="text-[15.5px] text-[#4a5560] leading-[1.6] max-w-[440px] mb-8">
          This is the actual pricing logic tradies use on site — tap an item below like you would in
          the app, and watch it drop straight into a priced quote with a running total. On site, you&apos;d
          do this by camera markup or a voice note instead of tapping a list.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {AVAILABLE_ITEMS.map((item) => {
            const added = addedIds.has(item.id);
            return (
              <button
                key={item.id}
                onClick={() => addItem(item)}
                disabled={added || sent}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-[13.5px] font-bold transition-all ${
                  added
                    ? "border-[#e2e5ea] bg-[#f8f9fa] text-[#a8b4bd] cursor-default"
                    : "border-[#0a1722] bg-white text-[#0a1722] hover:bg-[#0a1722] hover:text-white cursor-pointer"
                }`}
              >
                {added ? <Check size={15} /> : <Plus size={15} />}
                {item.label}
              </button>
            );
          })}
        </div>
        {items.length === 0 && (
          <p className="flex items-center gap-2 text-[13px] text-[#8b96a1] mt-5">
            <Camera size={14} /> On site, this is a photo tap or a voice note — try the chips above instead
          </p>
        )}
      </div>

      {/* Right: live quote panel (the "output") */}
      <div className="relative">
        <div className="bg-[#0a1722] rounded-3xl overflow-hidden shadow-2xl max-w-[420px] mx-auto">
          <div className="px-6 py-5 flex items-center justify-between">
            <span className="font-display text-[15px] text-white tracking-wide">SWIFTSCOPE</span>
            <span className="text-[10px] font-bold text-[#8aa4b4] uppercase tracking-widest">Live quote</span>
          </div>
          <div className="px-6 pb-5 flex items-center justify-between border-b border-white/10">
            <div>
              <p className="text-[10px] font-bold text-[#8aa4b4] uppercase tracking-widest mb-1">Total</p>
              <p className="text-[2rem] font-black text-[#ffb400] tabular-nums leading-none transition-all">
                ${total.toLocaleString()}
              </p>
            </div>
            <p className="text-[12.5px] text-[#8aa4b4]">{items.length} item{items.length === 1 ? "" : "s"}</p>
          </div>

          <div className="bg-white min-h-[280px] px-5 py-4">
            {items.length === 0 ? (
              <div className="h-[260px] flex flex-col items-center justify-center text-center px-4">
                <p className="text-[13.5px] font-bold text-[#0a1722] mb-1">Empty quote</p>
                <p className="text-[12.5px] text-[#8b96a1]">Tap an item on the left to add it here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className={`flex items-center justify-between bg-[#f8f9fa] rounded-xl px-4 py-3 transition-all ${
                      justAddedId === item.id ? "ring-2 ring-[#ffb400]" : ""
                    }`}
                  >
                    <div>
                      <p className="text-[13.5px] font-bold text-[#0a1722]">{item.label}</p>
                      <p className="text-[11.5px] text-[#8b96a1]">{item.detail}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-[13.5px] font-bold text-[#0a1722]">${item.price.toLocaleString()}</p>
                      {!sent && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-[11px] text-[#c94040] font-bold hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-5 pb-5 pt-1">
            {sent ? (
              <div className="flex items-center justify-center gap-2 bg-[#e8f5ec] text-[#1c7a3a] font-extrabold text-[14px] py-4 rounded-xl">
                <Check size={17} /> Sent — client notified
              </div>
            ) : (
              <button
                onClick={() => items.length > 0 && setSent(true)}
                disabled={items.length === 0}
                className={`w-full flex items-center justify-center gap-2 font-extrabold text-[14.5px] py-4 rounded-xl transition-colors ${
                  items.length === 0
                    ? "bg-[#e2e5ea] text-[#a8b4bd] cursor-not-allowed"
                    : "bg-[#ffb400] text-[#0a1722] hover:bg-[#e89e00]"
                }`}
              >
                <Send size={15} /> Send quote
              </button>
            )}
            {(items.length > 0 || sent) && (
              <button
                onClick={reset}
                className="w-full flex items-center justify-center gap-1.5 text-[12px] font-bold text-[#8b96a1] hover:text-[#0a1722] mt-3 transition-colors"
              >
                <RotateCcw size={12} /> Start again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
