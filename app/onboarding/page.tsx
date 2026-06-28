"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";
import { PLUMBER_DEFAULT_MATERIALS } from "@/lib/calcPlumber";
import { CARPENTER_DEFAULT_MATERIALS } from "@/lib/calcCarpenter";
import { ROOFER_DEFAULT_MATERIALS } from "@/lib/calcRoofer";
import { GENERIC_TRADE_TEMPLATES } from "@/lib/genericTrades";
import { Check, ChevronRight, ChevronLeft } from "lucide-react";

const TRADES = [
  { key: "electrician", label: "Electrician",      desc: "Powerpoints, switchboards, solar" },
  { key: "plumber",     label: "Plumber",           desc: "Tapware, HWU, rough-ins, gas" },
  { key: "carpenter",   label: "Carpenter",         desc: "Framing, doors, decking, fitout" },
  { key: "roofer",      label: "Roofer",            desc: "Colorbond, tiles, gutters, skylights" },
  { key: "painter",     label: "Painter",           desc: "Interior, exterior, feature walls" },
  { key: "tiler",       label: "Tiler",             desc: "Floor, wall, wet areas, outdoor" },
  { key: "landscaper",  label: "Landscaper",        desc: "Paving, turf, retaining, irrigation" },
  { key: "arborist",    label: "Arborist",          desc: "Tree removal, pruning, grinding" },
  { key: "concreter",   label: "Concreter",         desc: "Slabs, driveways, pathways" },
  { key: "fencer",      label: "Fencer",            desc: "Colorbond, timber, pool fencing" },
  { key: "aircon",      label: "Air conditioning",  desc: "Split systems, ducted, service" },
  { key: "surveyor",    label: "Surveyor",          desc: "Feature, boundary, construction" },
  { key: "custom",      label: "Custom",            desc: "Build your own quote template" },
];

const DEDICATED_DEFAULTS: Record<string, readonly { item_key: string; label: string; unit_cost: number }[]> = {
  electrician: ELECTRICIAN_DEFAULT_MATERIALS,
  plumber:     PLUMBER_DEFAULT_MATERIALS,
  carpenter:   CARPENTER_DEFAULT_MATERIALS,
  roofer:      ROOFER_DEFAULT_MATERIALS,
};

type MatRow = { item_key: string; label: string; unit_cost: number };

const STEPS = [
  { n: 1, label: "Your trade" },
  { n: 2, label: "Your business" },
  { n: 3, label: "Your rates" },
  { n: 4, label: "Material costs" },
];

export default function OnboardingPage() {
  const router = useRouter();

  // Step 1
  const [selected, setSelected] = useState<string[]>([]);
  // Step 2
  const [businessName,    setBusinessName]    = useState("");
  const [abn,             setAbn]             = useState("");
  const [licence,         setLicence]         = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  // Step 3
  const [hourlyRate,  setHourlyRate]  = useState(95);
  const [marginPct,   setMarginPct]   = useState(20);
  // Step 4 - materials per trade
  const [matsByTrade, setMatsByTrade] = useState<Record<string, MatRow[]>>({});
  const [activeTradeMat, setActiveTradeMat] = useState("");

  const [step,   setStep]   = useState(1);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // When trades are selected, initialise their material defaults
  useEffect(() => {
    const updated: Record<string, MatRow[]> = {};
    for (const t of selected) {
      if (matsByTrade[t]) { updated[t] = matsByTrade[t]; continue; }
      const defs = DEDICATED_DEFAULTS[t] ?? GENERIC_TRADE_TEMPLATES[t]?.defaultItems?.map((it) => ({
        item_key: it.label.toLowerCase().replace(/\W+/g, "_"),
        label: it.label,
        unit_cost: it.unit_cost,
      })) ?? [];
      updated[t] = defs.map((m) => ({ ...m }));
    }
    setMatsByTrade(updated);
    if (!activeTradeMat || !selected.includes(activeTradeMat)) {
      setActiveTradeMat(selected[0] ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function toggleTrade(key: string) {
    setSelected((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key]);
  }

  function updateMat(trade: string, key: string, field: "label" | "unit_cost", val: string) {
    setMatsByTrade((p) => ({
      ...p,
      [trade]: (p[trade] ?? []).map((r) =>
        r.item_key === key ? { ...r, [field]: field === "unit_cost" ? parseFloat(val) || 0 : val } : r
      ),
    }));
  }

  async function finish() {
    setSaving(true); setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in"); setSaving(false); return; }

    const { error: profileErr } = await supabase.from("profiles").update({
      trades:               selected,
      onboarded_at:         new Date().toISOString(),
      business_name:        businessName.trim() || null,
      abn:                  abn || null,
      license_number:       licence || null,
      business_address:     businessAddress || null,
      hourly_rate:          hourlyRate,
      materials_margin_pct: marginPct,
      terms_and_conditions: "Quote valid for 30 days. Materials and labour as listed above. Any variation to the scope of work will be quoted separately before proceeding. Payment due as per the terms stated on this quote.",
    }).eq("id", user.id);

    if (profileErr) { setError(profileErr.message); setSaving(false); return; }

    // Save materials for each trade
    for (const [trade, rows] of Object.entries(matsByTrade)) {
      const valid = rows.filter((r) => r.label.trim());
      if (!valid.length) continue;
      await supabase.from("material_items").upsert(
        valid.map((r) => ({ profile_id: user.id, trade, item_key: r.item_key, label: r.label, unit_cost: r.unit_cost })),
        { onConflict: "profile_id,item_key" }
      );
    }

    router.push("/electrician/dashboard");
    router.refresh();
  }

  const canProceed = [
    selected.length > 0,                // step 1
    true,                                // step 2 - all optional except business name shown as nudge
    hourlyRate > 0,                     // step 3
    true,                                // step 4
  ][step - 1];

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col">
      {/* Header */}
      <div className="bg-[var(--navy)] px-6 py-4 flex items-center justify-between shrink-0">
        <span className="font-display text-[15px] tracking-widest text-white">SWIFTSCOPE</span>
        <span className="text-[12px] text-[var(--steel-3)] font-semibold">Step {step} of {STEPS.length}</span>
      </div>

      {/* Progress bar */}
      <div className="bg-[var(--navy)] px-6 pb-4 shrink-0">
        <div className="flex gap-1.5">
          {STEPS.map((s) => (
            <div key={s.n} className="flex-1">
              <div className={`h-1 rounded-full transition-all ${s.n <= step ? "bg-[var(--amber)]" : "bg-white/20"}`} />
              <p className={`text-[10px] font-semibold mt-1.5 ${s.n <= step ? "text-[var(--amber)]" : "text-white/30"}`}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-8">

          {/* STEP 1 - Pick trades */}
          {step === 1 && (
            <>
              <h1 className="font-display text-[28px] text-[var(--ink)] mb-1">What trades do you do?</h1>
              <p className="text-[14px] text-[var(--ink-faint)] mb-6">Pick all that apply. You can change this in Settings.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
                {TRADES.map((t) => {
                  const on = selected.includes(t.key);
                  return (
                    <button key={t.key} onClick={() => toggleTrade(t.key)}
                      className={`text-left rounded-xl border-2 px-3 py-3 transition-all ${on
                        ? "border-[var(--navy)] bg-[var(--navy)]"
                        : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--navy)]/40"
                      }`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className={`font-bold text-[13px] ${on ? "text-white" : "text-[var(--ink)]"}`}>{t.label}</p>
                        {on && <Check size={13} className="text-[var(--amber)] shrink-0" strokeWidth={3} />}
                      </div>
                      <p className={`text-[11px] leading-snug ${on ? "text-[var(--steel-2)]" : "text-[var(--ink-faint)]"}`}>{t.desc}</p>
                    </button>
                  );
                })}
              </div>
              {selected.length > 0 && (
                <p className="text-[12.5px] text-[var(--ink-faint)] text-center mb-4">
                  {selected.length} trade{selected.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </>
          )}

          {/* STEP 2 - Business details */}
          {step === 2 && (
            <>
              <h1 className="font-display text-[28px] text-[var(--ink)] mb-1">Your business details</h1>
              <p className="text-[14px] text-[var(--ink-faint)] mb-6">
                These print on every quote you send. Get them right once, they fill in automatically.
              </p>
              <div className="card space-y-4 mb-4">
                <div>
                  <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                    Business name <span className="text-[var(--red)] font-bold">*</span>
                  </label>
                  <input value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                    className="app-field" placeholder="Spark Ease Electrical Services" autoFocus />
                  <p className="text-[11.5px] text-[var(--ink-faint)] mt-1">Shown in the quote header and emails</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                      ABN <span className="text-[var(--ink-faint)] font-normal">(optional)</span>
                    </label>
                    <input value={abn} onChange={(e) => setAbn(e.target.value)} className="app-field" placeholder="11 222 333 444" />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                      Licence <span className="text-[var(--ink-faint)] font-normal">(optional)</span>
                    </label>
                    <input value={licence} onChange={(e) => setLicence(e.target.value)} className="app-field" placeholder="REC 23538" />
                  </div>
                </div>
                <div>
                  <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                    Business address <span className="text-[var(--ink-faint)] font-normal">(optional)</span>
                  </label>
                  <input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)}
                    className="app-field" placeholder="Suburb, State" />
                </div>
              </div>
              <p className="text-[12px] text-[var(--ink-faint)] text-center">
                You can add your logo and payment details in Settings after setup.
              </p>
            </>
          )}

          {/* STEP 3 - Rates */}
          {step === 3 && (
            <>
              <h1 className="font-display text-[28px] text-[var(--ink)] mb-1">Your rates</h1>
              <p className="text-[14px] text-[var(--ink-faint)] mb-6">
                These two numbers drive every quote total. Set them once, adjust any time.
              </p>

              <div className="card space-y-5 mb-4">
                <div>
                  <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                    Hourly labour rate ($/hr)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] font-semibold">$</span>
                    <input
                      type="number" min={0} step={5} value={hourlyRate}
                      onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                      className="app-field pl-7 font-display text-[20px]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] text-[13px]">/hr</span>
                  </div>
                  <p className="text-[12px] text-[var(--ink-faint)] mt-1.5">
                    What you charge for your time. Tradies typically charge $75-$150/hr depending on trade and area.
                  </p>
                </div>

                <div className="border-t border-[var(--line-subtle)] pt-5">
                  <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                    Materials margin (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number" min={0} max={100} step={5} value={marginPct}
                      onChange={(e) => setMarginPct(parseFloat(e.target.value) || 0)}
                      className="app-field font-display text-[20px]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] text-[13px]">%</span>
                  </div>
                  <p className="text-[12px] text-[var(--ink-faint)] mt-1.5">
                    Added on top of your supplier cost. Most tradies charge 15-25%. Covers handling, waste, and your time to source.
                  </p>
                </div>
              </div>

              {/* Live example */}
              {hourlyRate > 0 && (
                <div className="bg-[var(--navy)] rounded-2xl p-4 text-[13px]">
                  <p className="text-[var(--steel-3)] font-bold uppercase tracking-wider text-[10px] mb-3">Example quote preview</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[var(--steel-2)]">Labour (4 hrs)</span>
                      <span className="text-white font-semibold tabular">${(hourlyRate * 4).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--steel-2)]">Materials $500 + {marginPct}% margin</span>
                      <span className="text-white font-semibold tabular">${Math.round(500 * (1 + marginPct / 100)).toLocaleString()}</span>
                    </div>
                    <div className="border-t border-white/10 pt-1.5 flex justify-between">
                      <span className="text-white font-bold">Total</span>
                      <span className="font-display text-[20px] text-[var(--amber)] tabular">
                        ${(hourlyRate * 4 + Math.round(500 * (1 + marginPct / 100))).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 4 - Material costs */}
          {step === 4 && (
            <>
              <h1 className="font-display text-[28px] text-[var(--ink)] mb-1">Your material costs</h1>
              <p className="text-[14px] text-[var(--ink-faint)] mb-2">
                These are your supplier prices ex-GST. We have pre-filled common items - update any that are wrong for your area.
              </p>
              <p className="text-[12.5px] text-[var(--amber-deep)] font-semibold mb-5">
                You can skip this and update prices in Settings later - but accurate prices = accurate quotes.
              </p>

              {/* Trade tabs if multiple */}
              {selected.length > 1 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                  {selected.map((t) => {
                    const tradeLabel = TRADES.find((x) => x.key === t)?.label ?? t;
                    return (
                      <button key={t} onClick={() => setActiveTradeMat(t)}
                        className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold whitespace-nowrap border-2 transition-colors ${
                          activeTradeMat === t ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"
                        }`}>
                        {tradeLabel}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Material table for active trade */}
              {activeTradeMat && matsByTrade[activeTradeMat] && (
                <div className="border border-[var(--line)] rounded-2xl overflow-hidden mb-4">
                  <div className="grid grid-cols-[1fr_110px] bg-[var(--app-bg)] border-b border-[var(--line)] px-4 py-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Item</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] text-right">Your cost</span>
                  </div>
                  <div className="divide-y divide-[var(--line-subtle)] max-h-[380px] overflow-y-auto">
                    {matsByTrade[activeTradeMat].map((r) => (
                      <div key={r.item_key} className="grid grid-cols-[1fr_110px] items-center px-4 py-2.5 hover:bg-[var(--app-bg)]">
                        <span className="text-[13.5px] text-[var(--ink)] pr-3">{r.label}</span>
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[var(--ink-faint)] text-[12px]">$</span>
                          <input
                            type="number" min={0} step={0.01}
                            value={r.unit_cost || ""}
                            onChange={(e) => updateMat(activeTradeMat, r.item_key, "unit_cost", e.target.value)}
                            className="w-20 text-right text-[13.5px] font-semibold text-[var(--ink)] bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-[var(--amber)] rounded px-1.5 py-1"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[12px] text-[var(--ink-faint)]">
                You can add, remove and edit items any time from Settings &gt; Material Pricing.
              </p>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="bg-[var(--red-bg)] border border-red-200 rounded-xl px-4 py-3 text-[13px] text-[var(--red)] font-semibold mt-4">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)} className="btn-secondary flex-1">
                <ChevronLeft size={16} /> Back
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={() => {
                  if (step === 2 && !businessName.trim()) { setError("Add your business name - it goes on every quote."); return; }
                  setError(null);
                  setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
                }}
                disabled={!canProceed}
                className="btn-primary flex-1">
                {step === 1 ? `Continue with ${selected.length} trade${selected.length !== 1 ? "s" : ""}` : "Continue"} <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={finish} disabled={saving} className="btn-primary flex-1">
                {saving ? "Setting up..." : "Start quoting"}
              </button>
            )}
          </div>

          {step === 4 && (
            <button onClick={finish} disabled={saving} className="w-full text-center text-[12.5px] text-[var(--ink-faint)] mt-3 hover:text-[var(--ink)] transition-colors">
              Skip and set prices later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
