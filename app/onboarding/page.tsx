"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";
import { PLUMBER_DEFAULT_MATERIALS } from "@/lib/calcPlumber";
import { CARPENTER_DEFAULT_MATERIALS } from "@/lib/calcCarpenter";
import { ROOFER_DEFAULT_MATERIALS } from "@/lib/calcRoofer";
import { GENERIC_TRADE_TEMPLATES } from "@/lib/genericTrades";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Upload,
  Download,
  Clock,
  Lightbulb,
  ArrowRight,
  Settings,
  Link2,
  FileText,
  TrendingUp,
  Building2,
  Sparkles,
} from "lucide-react";

const TRADES = [
  { key: "electrician", label: "Electrician",      desc: "Powerpoints, switchboards, solar",       popular: true },
  { key: "plumber",     label: "Plumber",           desc: "Tapware, HWU, rough-ins, gas",          popular: true },
  { key: "carpenter",   label: "Carpenter",         desc: "Framing, doors, decking, fitout",       popular: true },
  { key: "roofer",      label: "Roofer",            desc: "Colorbond, tiles, gutters, skylights",  popular: false },
  { key: "painter",     label: "Painter",           desc: "Interior, exterior, feature walls",     popular: true },
  { key: "tiler",       label: "Tiler",             desc: "Floor, wall, wet areas, outdoor",       popular: false },
  { key: "landscaper",  label: "Landscaper",        desc: "Paving, turf, retaining, irrigation",   popular: false },
  { key: "arborist",    label: "Arborist",          desc: "Tree removal, pruning, grinding",       popular: false },
  { key: "concreter",   label: "Concreter",         desc: "Slabs, driveways, pathways",            popular: false },
  { key: "fencer",      label: "Fencer",            desc: "Colorbond, timber, pool fencing",       popular: false },
  { key: "aircon",      label: "Air conditioning",  desc: "Split systems, ducted, service",        popular: false },
  { key: "surveyor",    label: "Surveyor",          desc: "Feature, boundary, construction",       popular: false },
  { key: "custom",      label: "Custom",            desc: "Build your own quote template",         popular: false },
];

const RATE_COMPARISON: Record<string, { min: number; max: number }> = {
  electrician: { min: 85, max: 120 },
  plumber:     { min: 90, max: 130 },
  carpenter:   { min: 70, max: 100 },
  painter:     { min: 55, max: 85 },
  roofer:      { min: 65, max: 95 },
  tiler:       { min: 60, max: 90 },
  landscaper:  { min: 55, max: 80 },
  arborist:    { min: 70, max: 110 },
  concreter:   { min: 60, max: 90 },
  fencer:      { min: 55, max: 85 },
  aircon:      { min: 80, max: 120 },
  surveyor:    { min: 90, max: 150 },
  custom:      { min: 65, max: 110 },
};

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
  const [completed, setCompleted] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(8);

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

  // Auto-redirect after completion
  useEffect(() => {
    if (!completed) return;
    const timer = setInterval(() => {
      setRedirectCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          router.push("/electrician/dashboard");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [completed, router]);

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

  const [csvMessage, setCsvMessage] = useState<string | null>(null);

  function downloadCsvTemplate(trade: string) {
    const rows = matsByTrade[trade] ?? [];
    const lines = ["item_key,label,unit_cost", ...rows.map((m) => `${m.item_key},"${m.label}",${m.unit_cost}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swiftscope-${trade}-prices-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCsvUpload(trade: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const header = lines[0]?.toLowerCase().split(",") ?? [];
      const keyIdx = header.findIndex((h) => h.includes("key") || h.includes("item"));
      const costIdx = header.findIndex((h) => h.includes("cost") || h.includes("price"));
      if (keyIdx === -1 || costIdx === -1) {
        setCsvMessage("Could not find item and cost columns in that file - try the template instead.");
        return;
      }
      const updates = new Map<string, number>();
      for (const line of lines.slice(1)) {
        const cols = line.split(",");
        const key = cols[keyIdx]?.trim().replace(/^"|"$/g, "");
        const cost = parseFloat(cols[costIdx]?.replace(/[^0-9.]/g, "") ?? "");
        if (key && !isNaN(cost)) updates.set(key, cost);
      }
      let matched = 0;
      setMatsByTrade((p) => ({
        ...p,
        [trade]: (p[trade] ?? []).map((r) => {
          if (updates.has(r.item_key)) { matched++; return { ...r, unit_cost: updates.get(r.item_key)! }; }
          return r;
        }),
      }));
      setCsvMessage(matched > 0 ? `Updated ${matched} price${matched === 1 ? "" : "s"}.` : "No matching items found in that file.");
      e.target.value = "";
    };
    reader.readAsText(file);
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

    setCompleted(true);
  }

  const canProceed = [
    selected.length > 0,                // step 1
    true,                                // step 2 - all optional except business name shown as nudge
    hourlyRate > 0,                     // step 3
    true,                                // step 4
  ][step - 1];

  // Get first selected trade for rate comparison
  const firstTrade = selected[0] ?? "";
  const firstTradeLabel = TRADES.find((t) => t.key === firstTrade)?.label ?? "";
  const rateCompare = RATE_COMPARISON[firstTrade] ?? null;

  // Tip box component
  function TipBox({ children, icon = "lightbulb" }: { children: React.ReactNode; icon?: "lightbulb" | "clock" | "trending" }) {
    const IconComp = icon === "clock" ? Clock : icon === "trending" ? TrendingUp : Lightbulb;
    return (
      <div className="flex gap-2.5 bg-[var(--amber)]/8 border border-[var(--amber)]/20 rounded-xl px-4 py-3 mt-5">
        <IconComp size={16} className="text-[var(--amber)] shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{children}</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-[var(--app-bg)] flex flex-col">
        <style>{`
          @keyframes drawCheck {
            0% { stroke-dashoffset: 100; }
            100% { stroke-dashoffset: 0; }
          }
          @keyframes scaleIn {
            0% { transform: scale(0); opacity: 0; }
            60% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes fadeUp {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulseSoft {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          .checkCircle { animation: scaleIn 0.5s ease-out forwards; }
          .checkPath { stroke-dasharray: 100; stroke-dashoffset: 100; animation: drawCheck 0.5s ease-out 0.4s forwards; }
          .fadeUp1 { animation: fadeUp 0.5s ease-out 0.6s both; }
          .fadeUp2 { animation: fadeUp 0.5s ease-out 0.8s both; }
          .fadeUp3 { animation: fadeUp 0.5s ease-out 1.0s both; }
          .fadeUp4 { animation: fadeUp 0.5s ease-out 1.2s both; }
        `}</style>

        {/* Header */}
        <div className="bg-[var(--navy)] px-6 py-4 flex items-center justify-center shrink-0">
          <span className="font-display text-[15px] tracking-widest text-white">SWIFTSCOPE</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          {/* Animated checkmark */}
          <div className="checkCircle mb-6">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="36" stroke="var(--amber)" strokeWidth="3" fill="none" />
              <path className="checkPath" d="M24 42L34 52L56 30" stroke="var(--amber)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>

          <h1 className="fadeUp1 font-display text-[32px] text-[var(--ink)] text-center mb-2">You are all set!</h1>
          <p className="fadeUp2 text-[14px] text-[var(--ink-soft)] text-center max-w-sm mb-8">
            Your quote templates are ready. Here is what you can do now:
          </p>

          {/* Quick action cards */}
          <div className="fadeUp3 grid gap-3 w-full max-w-sm mb-8">
            <button
              onClick={() => router.push("/electrician")}
              className="flex items-center gap-3.5 bg-[var(--navy)] rounded-xl px-5 py-4 text-left hover:bg-[var(--navy)]/90 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <div className="w-10 h-10 rounded-lg bg-[var(--amber)]/15 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-[var(--amber)]" />
              </div>
              <div>
                <p className="text-white font-bold text-[14px]">Create your first quote</p>
                <p className="text-[var(--steel-2)] text-[12px]">Build a quote in under 2 minutes</p>
              </div>
              <ArrowRight size={16} className="text-[var(--steel-3)] ml-auto" />
            </button>

            <button
              onClick={() => router.push("/settings")}
              className="flex items-center gap-3.5 bg-[var(--surface)] border border-[var(--line)] rounded-xl px-5 py-4 text-left hover:border-[var(--navy)]/30 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <div className="w-10 h-10 rounded-lg bg-[var(--navy)]/8 flex items-center justify-center shrink-0">
                <Settings size={18} className="text-[var(--navy)]" />
              </div>
              <div>
                <p className="text-[var(--ink)] font-bold text-[14px]">Set up your logo</p>
                <p className="text-[var(--ink-faint)] text-[12px]">Add your branding to quotes</p>
              </div>
              <ArrowRight size={16} className="text-[var(--steel-3)] ml-auto" />
            </button>

            <button
              onClick={() => router.push("/settings")}
              className="flex items-center gap-3.5 bg-[var(--surface)] border border-[var(--line)] rounded-xl px-5 py-4 text-left hover:border-[var(--navy)]/30 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <div className="w-10 h-10 rounded-lg bg-[var(--navy)]/8 flex items-center justify-center shrink-0">
                <Link2 size={18} className="text-[var(--navy)]" />
              </div>
              <div>
                <p className="text-[var(--ink)] font-bold text-[14px]">Connect Xero</p>
                <p className="text-[var(--ink-faint)] text-[12px]">Sync invoices automatically</p>
              </div>
              <ArrowRight size={16} className="text-[var(--steel-3)] ml-auto" />
            </button>
          </div>

          <p className="fadeUp4 text-[12px] text-[var(--ink-faint)]">
            Taking you to your dashboard in {redirectCountdown} seconds...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col">
      <style>{`
        @keyframes stepEnter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseAmber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 180, 0, 0.25); }
          50%      { box-shadow: 0 0 0 6px rgba(255, 180, 0, 0); }
        }
        .stepEnter { animation: stepEnter 0.35s ease-out both; }
        .btnPrimaryPulse:hover { animation: pulseAmber 1s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div className="bg-[var(--navy)] px-6 py-4 flex items-center justify-between shrink-0">
        <span className="font-display text-[15px] tracking-widest text-white">SWIFTSCOPE</span>
        <span className="text-[12px] text-[var(--steel-3)] font-semibold">Step {step} of {STEPS.length}</span>
      </div>

      {/* Progress bar */}
      <div className="bg-[var(--navy)] px-6 pb-4 shrink-0">
        <div className="flex gap-2">
          {STEPS.map((s) => {
            const isActive = s.n === step;
            const isComplete = s.n < step;
            return (
              <div key={s.n} className="flex-1">
                <div className="relative h-2 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${
                      isComplete || isActive ? "bg-[var(--amber)]" : "bg-transparent"
                    }`}
                    style={{ width: isComplete ? "100%" : isActive ? "60%" : "0%" }}
                  />
                </div>
                <p className={`text-[10px] font-bold mt-2 transition-colors duration-300 ${
                  isActive ? "text-[var(--amber)]" : isComplete ? "text-white/70" : "text-white/25"
                }`}>
                  {isComplete ? "Done" : s.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-8">

          {/* STEP 1 - Pick trades */}
          {step === 1 && (
            <div className="stepEnter" key="step1">
              <h1 className="font-display text-[28px] text-[var(--ink)] mb-2">What trades do you do?</h1>
              <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-6">
                Pick your trades and we will set up quote templates with the right materials and pricing for each one. This takes 2 minutes and saves you hours every week.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
                {TRADES.map((t) => {
                  const on = selected.includes(t.key);
                  return (
                    <button key={t.key} onClick={() => toggleTrade(t.key)}
                      className={`relative text-left rounded-xl border-2 px-3 py-3 transition-all ${on
                        ? "border-[var(--navy)] bg-[var(--navy)]"
                        : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--navy)]/40"
                      }`}>
                      {t.popular && !on && (
                        <span className="absolute -top-2 -right-1 bg-[var(--amber)] text-[var(--navy)] text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                          Popular
                        </span>
                      )}
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

              <TipBox>
                Most tradies pick 1-2 trades. You can always add more later in Settings.
              </TipBox>
            </div>
          )}

          {/* STEP 2 - Business details */}
          {step === 2 && (
            <div className="stepEnter" key="step2">
              <h1 className="font-display text-[28px] text-[var(--ink)] mb-2">Your business details</h1>
              <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-6">
                These details appear on every quote you send. Set them up once, never think about them again.
              </p>

              {/* Business name preview */}
              {businessName.trim() && (
                <div className="bg-[var(--navy)] rounded-xl p-4 mb-5">
                  <p className="text-[var(--steel-3)] font-bold uppercase tracking-wider text-[9px] mb-2">Quote preview</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                      <Building2 size={16} className="text-[var(--amber)]" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-[14px]">{businessName}</p>
                      <p className="text-[var(--steel-2)] text-[11px]">{abn ? `ABN: ${abn}` : "Your ABN will appear here"}</p>
                    </div>
                  </div>
                </div>
              )}

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

              <TipBox icon="lightbulb">
                Your ABN and licence number build trust with customers. Add them now or come back to Settings later.
              </TipBox>
            </div>
          )}

          {/* STEP 3 - Rates */}
          {step === 3 && (
            <div className="stepEnter" key="step3">
              <h1 className="font-display text-[28px] text-[var(--ink)] mb-2">Your rates</h1>
              <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-6">
                These two numbers power every quote. Most tradies charge $75-$150/hr depending on trade and area.
              </p>

              <div className="card space-y-5 mb-4">
                <div>
                  <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                    Hourly labour rate ($/hr)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] font-semibold pointer-events-none">$</span>
                    <input
                      type="number" min={0} step={5} value={hourlyRate}
                      onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                      className="app-field font-display text-[20px]"
                      style={{ paddingLeft: "30px", paddingRight: "44px" }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] text-[13px] pointer-events-none">/hr</span>
                  </div>
                  <p className="text-[12px] text-[var(--ink-faint)] mt-1.5">
                    What you charge for your time.
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
                      style={{ paddingRight: "36px" }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] text-[13px] pointer-events-none">%</span>
                  </div>
                  <p className="text-[12px] text-[var(--ink-faint)] mt-1.5">
                    Added on top of your supplier cost. Most tradies charge 15-25%. Covers handling, waste, and your time to source.
                  </p>
                </div>
              </div>

              {/* Rate comparison for selected trade */}
              {rateCompare && (
                <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <TrendingUp size={14} className="text-[var(--amber)]" />
                    <p className="text-[12px] font-bold text-[var(--ink)]">What {firstTradeLabel}s typically charge</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--ink-soft)]">Hourly rate range</span>
                    <span className="text-[14px] font-bold text-[var(--navy)]">${rateCompare.min} - ${rateCompare.max}/hr</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-[var(--app-bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--amber)] rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(15, ((hourlyRate - rateCompare.min) / (rateCompare.max - rateCompare.min)) * 100))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">
                    Your rate: <span className="font-semibold text-[var(--ink-soft)]">${hourlyRate}/hr</span>
                    {hourlyRate < rateCompare.min ? " - below typical range" : hourlyRate > rateCompare.max ? " - above typical range" : " - within typical range"}
                  </p>
                </div>
              )}

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

              <TipBox icon="lightbulb">
                You can change this any time in Settings. Start with your current rate.
              </TipBox>
            </div>
          )}

          {/* STEP 4 - Material costs */}
          {step === 4 && (
            <div className="stepEnter" key="step4">
              <h1 className="font-display text-[28px] text-[var(--ink)] mb-2">Your material costs</h1>
              <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-4">
                We have pre-filled typical prices. Update any that are different for your suppliers.
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

              {/* CSV import */}
              {activeTradeMat && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <label className="btn-secondary text-[12.5px] py-2 px-3 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform">
                    <Upload size={13} /> Upload price CSV
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => handleCsvUpload(activeTradeMat, e)} />
                  </label>
                  <button onClick={() => downloadCsvTemplate(activeTradeMat)} className="btn-secondary text-[12.5px] py-2 px-3 hover:scale-[1.02] active:scale-[0.98] transition-transform">
                    <Download size={13} /> Download template
                  </button>
                  {csvMessage && <span className="text-[12.5px] text-[var(--ink-soft)]">{csvMessage}</span>}
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
                      <div key={r.item_key} className="grid grid-cols-[1fr_110px] items-center px-4 py-2.5 hover:bg-[var(--app-bg)] transition-colors">
                        <span className="text-[13.5px] text-[var(--ink)] pr-3">{r.label}</span>
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[var(--ink-faint)] text-[12px]">$</span>
                          <input
                            type="number" min={0} step={0.01}
                            value={r.unit_cost || ""}
                            onChange={(e) => updateMat(activeTradeMat, r.item_key, "unit_cost", e.target.value)}
                            className="app-field w-24 text-right text-[13.5px] font-semibold text-[var(--ink)] py-1.5 px-2"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <TipBox icon="lightbulb">
                Pro tip: Download the template, fill it in Excel, then upload it to update everything at once.
              </TipBox>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-[var(--red-bg)] border border-red-200 rounded-xl px-4 py-3 text-[13px] text-[var(--red)] font-semibold mt-4 flex items-start gap-2.5">
              <span className="shrink-0 mt-0.5">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              {error === "Add your business name - it goes on every quote."
                ? error
                : `Oops - ${error}. Give it another try or reach out if you need a hand.`}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button onClick={() => { setError(null); setStep((s) => (s - 1) as 1 | 2 | 3 | 4); }}
                className="btn-secondary flex-1 text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors">
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
                className="btn-primary flex-1 btnPrimaryPulse disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]">
                {step === 1 ? `Continue with ${selected.length} trade${selected.length !== 1 ? "s" : ""}` : "Continue"} <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={finish} disabled={saving} className="btn-primary flex-1 btnPrimaryPulse transition-all hover:scale-[1.02] active:scale-[0.98]">
                {saving ? "Setting up..." : "Start quoting"}
              </button>
            )}
          </div>

          {step === 4 && (
            <button onClick={finish} disabled={saving}
              className="w-full text-center text-[13px] text-[var(--ink-faint)] mt-4 py-2 hover:text-[var(--ink)] transition-colors font-semibold">
              Skip and set prices later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
