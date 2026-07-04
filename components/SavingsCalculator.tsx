"use client";

import { useState } from "react";
import { Check, Plus, X, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Platform {
  id:          string;
  name:        string;
  category:    string;
  pricePerSeat:number;   // AUD/month
  avgSeats:    number;   // typical for a small trade business
  description: string;
}

const PLATFORMS: Platform[] = [
  // Quoting & job management
  { id:"servicem8",   name:"ServiceM8",   category:"Job management",    pricePerSeat:79,   avgSeats:1, description:"Job management for trade businesses" },
  { id:"fergus",      name:"Fergus",      category:"Job management",    pricePerSeat:89,   avgSeats:1, description:"Field service management" },
  { id:"simpro",      name:"simPRO",      category:"Job management",    pricePerSeat:199,  avgSeats:2, description:"Enterprise trade software" },
  { id:"tradify",     name:"Tradify",     category:"Job management",    pricePerSeat:35,   avgSeats:1, description:"Trade job management" },
  { id:"jobber",      name:"Jobber",      category:"Job management",    pricePerSeat:69,   avgSeats:1, description:"Field service management" },
  { id:"groundplan",  name:"GroundPlan",  category:"Estimating",        pricePerSeat:69,   avgSeats:1, description:"Takeoff and estimating" },
  { id:"buildxact",   name:"Buildxact",   category:"Estimating",        pricePerSeat:249,  avgSeats:1, description:"Construction estimating" },
  { id:"hipages",     name:"HiPages",     category:"Lead generation",   pricePerSeat:200,  avgSeats:1, description:"Trade lead marketplace" },
  { id:"oneflare",    name:"Oneflare",    category:"Lead generation",   pricePerSeat:150,  avgSeats:1, description:"Trade lead marketplace" },
  { id:"airtasker",   name:"Airtasker",   category:"Lead generation",   pricePerSeat:100,  avgSeats:1, description:"Task marketplace (avg monthly fees)" },
  { id:"xero",        name:"Xero",        category:"Accounting",        pricePerSeat:70,   avgSeats:1, description:"Accounting and invoicing" },
  { id:"quickbooks",  name:"QuickBooks",  category:"Accounting",        pricePerSeat:55,   avgSeats:1, description:"Accounting software" },
  { id:"deputy",      name:"Deputy",      category:"Scheduling",        pricePerSeat:7,    avgSeats:3, description:"Workforce scheduling (per employee)" },
  { id:"calendly",    name:"Calendly",    category:"Scheduling",        pricePerSeat:20,   avgSeats:1, description:"Appointment scheduling" },
  { id:"dropbox",     name:"Dropbox",     category:"File storage",      pricePerSeat:22,   avgSeats:1, description:"Cloud file storage" },
  { id:"monday",      name:"Monday.com",  category:"Project management",pricePerSeat:18,   avgSeats:2, description:"Project management" },
];

const CATEGORIES = [...new Set(PLATFORMS.map(p => p.category))];

interface SelectedPlatform {
  id:        string;
  seats:     number;
  priceMode: "average" | "custom";
  customPrice:number;
}

const SWIFTSCOPE_PRICE = 45; // AUD/month all inclusive

export default function SavingsCalculator() {
  const [selected,   setSelected]   = useState<SelectedPlatform[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [customName,   setCustomName]   = useState("");
  const [customPrice2, setCustomPrice2] = useState("");
  const [customList,   setCustomList]   = useState<{name:string;price:number}[]>([]);
  const [showResult,   setShowResult]   = useState(false);

  function effectivePrice(s: SelectedPlatform): number {
    const p = PLATFORMS.find(p => p.id === s.id);
    if (!p) return 0;
    if (s.priceMode === "custom") return s.customPrice * s.seats;
    return p.pricePerSeat * s.seats;
  }

  function totalCurrent(): number {
    const platformTotal = selected.reduce((sum, s) => sum + effectivePrice(s), 0);
    const customTotal   = customList.reduce((sum, c) => sum + c.price, 0);
    return platformTotal + customTotal;
  }

  function monthlySaving(): number {
    return Math.max(0, totalCurrent() - SWIFTSCOPE_PRICE);
  }

  function annualSaving(): number {
    return monthlySaving() * 12;
  }

  function toggle(id: string) {
    const p = PLATFORMS.find(p => p.id === id)!;
    setSelected(prev => {
      if (prev.find(s => s.id === id)) return prev.filter(s => s.id !== id);
      return [...prev, { id, seats: p.avgSeats, priceMode: "average", customPrice: p.pricePerSeat }];
    });
  }

  function updateSeats(id: string, seats: number) {
    setSelected(prev => prev.map(s => s.id === id ? { ...s, seats: Math.max(1, seats) } : s));
  }

  function updatePriceMode(id: string, mode: "average" | "custom") {
    setSelected(prev => prev.map(s => s.id === id ? { ...s, priceMode: mode } : s));
  }

  function updateCustomPrice(id: string, price: number) {
    setSelected(prev => prev.map(s => s.id === id ? { ...s, customPrice: price } : s));
  }

  function addCustomPlatform() {
    if (!customName.trim() || !customPrice2) return;
    setCustomList(prev => [...prev, { name: customName.trim(), price: parseFloat(customPrice2) }]);
    setCustomName(""); setCustomPrice2("");
  }

  const total = totalCurrent();
  const saving = monthlySaving();
  const annualSave = annualSaving();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Platform picker */}
      <div className="bg-white border border-[#e8ecef] rounded-2xl overflow-hidden mb-4">
        <button
          onClick={() => setShowPicker(p => !p)}
          className="w-full flex items-center justify-between px-6 py-4 text-left"
        >
          <div>
            <p className="font-bold text-[15px] text-[#0a1722]">Select your current platforms</p>
            <p className="text-[12.5px] text-[#5a6a78] mt-0.5">
              {selected.length === 0 ? "Click to choose what you're currently paying for" : `${selected.length} platform${selected.length !== 1 ? "s" : ""} selected`}
            </p>
          </div>
          {showPicker ? <ChevronUp size={18} className="text-[#5a6a78] shrink-0" /> : <ChevronDown size={18} className="text-[#5a6a78] shrink-0" />}
        </button>

        {showPicker && (
          <div className="border-t border-[#e8ecef]">
            {/* Category tabs */}
            <div className="flex gap-1 px-4 pt-4 pb-2 overflow-x-auto">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="text-[11.5px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors"
                  style={{
                    background: activeCategory === cat ? "#0a1722" : "#f8f9fa",
                    color: activeCategory === cat ? "white" : "#5a6a78",
                    border: `1px solid ${activeCategory === cat ? "#0a1722" : "#e8ecef"}`,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Platform grid */}
            <div className="grid sm:grid-cols-2 gap-2 px-4 pb-4">
              {PLATFORMS.filter(p => p.category === activeCategory).map(p => {
                const isSelected = selected.some(s => s.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all"
                    style={{ borderColor: isSelected ? "#0a1722" : "#e8ecef", background: isSelected ? "#f8f9fa" : "white" }}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "bg-[#0a1722] border-[#0a1722]" : "border-[#d1d9e0]"}`}>
                      {isSelected && <Check size={11} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[13px] text-[#0a1722]">{p.name}</p>
                      <p className="text-[11px] text-[#5a6a78]">${p.pricePerSeat}/seat/mo</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected platform config */}
      {selected.length > 0 && (
        <div className="bg-white border border-[#e8ecef] rounded-2xl p-5 mb-4">
          <p className="font-bold text-[13px] text-[#0a1722] mb-3">Adjust seats and pricing</p>
          <div className="space-y-3">
            {selected.map(s => {
              const p = PLATFORMS.find(p => p.id === s.id)!;
              const lineTotal = effectivePrice(s);
              return (
                <div key={s.id} className="flex items-center gap-3 bg-[#f8f9fa] rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13px] text-[#0a1722]">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {/* Price mode toggle */}
                      <div className="flex gap-0.5 bg-[#e8ecef] rounded-lg p-0.5">
                        {(["average","custom"] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => updatePriceMode(s.id, mode)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors"
                            style={{ background: s.priceMode === mode ? "white" : "transparent", color: s.priceMode === mode ? "#0a1722" : "#5a6a78" }}
                          >
                            {mode === "average" ? "Avg price" : "My price"}
                          </button>
                        ))}
                      </div>
                      {/* Custom price input */}
                      {s.priceMode === "custom" && (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-[#5a6a78]">$/seat</span>
                          <input
                            type="number" min={0} value={s.customPrice || ""}
                            onChange={e => updateCustomPrice(s.id, parseFloat(e.target.value) || 0)}
                            className="w-16 text-[12px] font-bold border border-[#d1d9e0] rounded-lg px-2 py-0.5 bg-white text-center"
                          />
                        </div>
                      )}
                      {/* Seats */}
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-[#5a6a78]">Seats</span>
                        <input
                          type="number" min={1} value={s.seats}
                          onChange={e => updateSeats(s.id, parseInt(e.target.value) || 1)}
                          className="w-12 text-[12px] font-bold border border-[#d1d9e0] rounded-lg px-2 py-0.5 bg-white text-center"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[14px] text-[#0a1722]">${lineTotal}/mo</p>
                  </div>
                  <button onClick={() => setSelected(prev => prev.filter(x => x.id !== s.id))} className="text-[#d1d9e0] hover:text-red-400 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add custom platform */}
      <div className="bg-white border border-[#e8ecef] rounded-2xl p-5 mb-4">
        <p className="font-bold text-[13px] text-[#0a1722] mb-3">Add other tools not listed</p>
        <div className="flex gap-2 flex-wrap">
          <input
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addCustomPlatform(); }}
            placeholder="Platform name"
            className="flex-1 min-w-[140px] border border-[#d1d9e0] rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-[#0a1722]"
          />
          <div className="flex items-center gap-1 border border-[#d1d9e0] rounded-xl px-3 py-2 bg-white">
            <span className="text-[13px] text-[#5a6a78]">$</span>
            <input
              type="number" min={0} value={customPrice2}
              onChange={e => setCustomPrice2(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addCustomPlatform(); }}
              placeholder="Price/mo"
              className="w-20 text-[13px] focus:outline-none"
            />
          </div>
          <button
            onClick={addCustomPlatform}
            disabled={!customName.trim() || !customPrice2}
            className="flex items-center gap-1.5 bg-[#0a1722] text-white font-bold text-[13px] px-4 py-2 rounded-xl disabled:opacity-40"
          >
            <Plus size={13} /> Add
          </button>
        </div>
        {customList.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {customList.map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-[#f8f9fa] rounded-xl px-3 py-2">
                <span className="font-semibold text-[13px] text-[#0a1722]">{c.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[13px]">${c.price}/mo</span>
                  <button onClick={() => setCustomList(prev => prev.filter((_, j) => j !== i))} className="text-[#d1d9e0] hover:text-red-400">
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calculate button */}
      {(selected.length > 0 || customList.length > 0) && (
        <button
          onClick={() => setShowResult(true)}
          className="w-full bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] py-4 rounded-xl flex items-center justify-center gap-2 mb-6"
        >
          Calculate my savings <ArrowRight size={15} />
        </button>
      )}

      {/* Result card */}
      {showResult && (selected.length > 0 || customList.length > 0) && (
        <div className="bg-[#0a1722] rounded-2xl p-6 sm:p-8 text-center">
          <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">Your savings estimate</p>

          <div className="grid sm:grid-cols-3 gap-4 mb-6 text-left">
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-[11px] text-white/40 font-bold uppercase tracking-wide mb-1">Currently paying</p>
              <p className="font-display text-[2.2rem] text-white leading-none">${total.toLocaleString()}</p>
              <p className="text-[12px] text-white/40 mt-1">per month</p>
            </div>
            <div className="bg-[#ffb400]/10 border border-[#ffb400]/30 rounded-xl p-4">
              <p className="text-[11px] text-[#ffb400] font-bold uppercase tracking-wide mb-1">Swiftscope</p>
              <p className="font-display text-[2.2rem] text-white leading-none">${SWIFTSCOPE_PRICE}</p>
              <p className="text-[12px] text-white/40 mt-1">per month, all in</p>
            </div>
            <div className="bg-green-400/10 border border-green-400/30 rounded-xl p-4">
              <p className="text-[11px] text-green-400 font-bold uppercase tracking-wide mb-1">You save</p>
              <p className="font-display text-[2.2rem] text-green-400 leading-none">${saving.toLocaleString()}</p>
              <p className="text-[12px] text-white/40 mt-1">per month</p>
            </div>
          </div>

          {annualSave > 0 && (
            <div className="bg-white/5 rounded-xl px-5 py-4 mb-6">
              <p className="text-white/60 text-[13px]">That&apos;s <span className="font-extrabold text-white text-[18px]">${annualSave.toLocaleString()}</span> back in your pocket every year</p>
            </div>
          )}

          <p className="text-white/40 text-[11.5px] mb-5">
            Swiftscope replaces quoting, job management, scheduling, and Xero sync. Excludes accounting software.
          </p>

          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-10 py-4 rounded-xl hover:opacity-90"
          >
            Start free 3-day trial <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* Zero savings state */}
      {showResult && total <= SWIFTSCOPE_PRICE && (selected.length > 0 || customList.length > 0) && (
        <div className="bg-[#0a1722] rounded-2xl p-6 text-center">
          <p className="text-white font-bold text-[16px] mb-2">You&apos;re already running lean</p>
          <p className="text-white/50 text-[13px] mb-4">
            Your current spend is ${total}/mo. Swiftscope is $39/mo and adds quoting, job management, scheduling, and Xero sync in one place.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-8 py-3.5 rounded-xl hover:opacity-90">
            Start free 3-day trial <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
