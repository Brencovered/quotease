"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";
import { PLUMBER_DEFAULT_MATERIALS } from "@/lib/calcPlumber";
import { CARPENTER_DEFAULT_MATERIALS } from "@/lib/calcCarpenter";
import { ROOFER_DEFAULT_MATERIALS } from "@/lib/calcRoofer";
import { Check } from "lucide-react";

const TRADES = [
  { key: "electrician", label: "Electrician", emoji: "⚡", desc: "Residential & commercial electrical" },
  { key: "plumber",     label: "Plumber",     emoji: "🔧", desc: "Plumbing, drainage & gas fitting" },
  { key: "carpenter",   label: "Carpenter",   emoji: "🪚", desc: "Framing, fitout, decking & more" },
  { key: "roofer",      label: "Roofer",      emoji: "🏠", desc: "Roofing, gutters & flashings" },
];

const TRADE_SEED: Record<string, readonly { item_key: string; label: string; unit_cost: number }[]> = {
  electrician: ELECTRICIAN_DEFAULT_MATERIALS,
  plumber:     PLUMBER_DEFAULT_MATERIALS,
  carpenter:   CARPENTER_DEFAULT_MATERIALS,
  roofer:      ROOFER_DEFAULT_MATERIALS,
};

const DEFAULT_TERMS =
  "Quote valid for 30 days. Materials and labour as listed above. Any variation to the scope of work will be quoted separately before proceeding. Payment due as per the terms stated on this quote.";

export default function OnboardingPage() {
  const router = useRouter();
  const [step,     setStep]     = useState<1 | 2>(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [abn,      setAbn]      = useState("");
  const [licence,  setLicence]  = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  function toggle(key: string) {
    setSelected((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key]);
  }

  async function finish() {
    if (!businessName.trim()) { setError("Add your business name - it goes on every quote."); return; }
    setSaving(true); setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in"); setSaving(false); return; }

    const { error: updateError } = await supabase.from("profiles").update({
      trades: selected,
      onboarded_at: new Date().toISOString(),
      business_name: businessName.trim(),
      abn: abn || null,
      license_number: licence || null,
      business_address: businessAddress || null,
      terms_and_conditions: DEFAULT_TERMS,
    }).eq("id", user.id);

    if (updateError) { setError(updateError.message); setSaving(false); return; }

    for (const t of selected) {
      const defaults = TRADE_SEED[t];
      if (!defaults) continue;
      await supabase.from("material_items").upsert(
        defaults.map((m) => ({ profile_id: user.id, trade: t, item_key: m.item_key, label: m.label, unit_cost: m.unit_cost })),
        { onConflict: "profile_id,item_key" }
      );
    }

    router.push("/settings/materials");
    router.refresh();
  }

  // Step 1 - pick trades
  if (step === 1) {
    return (
      <div className="min-h-screen bg-[var(--app-bg)] flex flex-col">
        <div className="bg-[var(--navy)] px-6 py-4 flex items-center justify-between">
          <span className="font-display text-[15px] tracking-widest text-white">QUOTEASE</span>
          <span className="text-[12px] text-[var(--steel-3)] font-semibold">Step 1 of 2</span>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
            <h1 className="font-display text-[28px] text-[var(--ink)] mb-1">What trades do you do?</h1>
            <p className="text-[14px] text-[var(--ink-faint)] mb-6">Pick all that apply. You can add more in Settings later.</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {TRADES.map((t) => {
                const on = selected.includes(t.key);
                return (
                  <button key={t.key} onClick={() => toggle(t.key)}
                    className={`text-left rounded-2xl border-2 p-4 transition-all ${on
                      ? "border-[var(--navy)] bg-[var(--navy)]"
                      : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--navy)]/40"
                    }`}>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl">{t.emoji}</span>
                      {on && (
                        <span className="w-5 h-5 rounded-full bg-[var(--amber)] flex items-center justify-center">
                          <Check size={11} className="text-[var(--navy)]" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <p className={`font-bold text-[14px] mb-0.5 ${on ? "text-white" : "text-[var(--ink)]"}`}>{t.label}</p>
                    <p className={`text-[11.5px] leading-snug ${on ? "text-[var(--steel-2)]" : "text-[var(--ink-faint)]"}`}>{t.desc}</p>
                  </button>
                );
              })}
            </div>

            <button onClick={() => setStep(2)} disabled={selected.length === 0} className="btn-primary">
              Continue →
            </button>

            {selected.length > 0 && (
              <p className="text-center text-[12.5px] text-[var(--ink-faint)] mt-3">
                {selected.length} trade{selected.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 2 - minimal company details, skip-friendly
  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col">
      <div className="bg-[var(--navy)] px-6 py-4 flex items-center justify-between">
        <span className="font-display text-[15px] tracking-widest text-white">QUOTEASE</span>
        <span className="text-[12px] text-[var(--steel-3)] font-semibold">Step 2 of 2</span>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <h1 className="font-display text-[28px] text-[var(--ink)] mb-1">Almost there</h1>
          <p className="text-[14px] text-[var(--ink-faint)] mb-6">
            These show up on your quotes. Business name&apos;s the only one we need now - the rest can wait.
          </p>

          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 mb-4 space-y-3">
            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Business name</label>
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="app-field" placeholder="Spark Ease Electrical Services" />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">ABN <span className="text-[var(--ink-faint)] font-normal">(optional)</span></label>
              <input value={abn} onChange={(e) => setAbn(e.target.value)} className="app-field" placeholder="11 222 333 444" />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Licence number <span className="text-[var(--ink-faint)] font-normal">(optional)</span></label>
              <input value={licence} onChange={(e) => setLicence(e.target.value)} className="app-field" placeholder="e.g. REC 23538" />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Business address <span className="text-[var(--ink-faint)] font-normal">(optional)</span></label>
              <input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="app-field" placeholder="Suburb, State" />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-[13px] text-amber-900 font-semibold">Free during early access</p>
            <p className="text-[12.5px] text-amber-800 mt-0.5">
              No charge while we&apos;re building this out. In return, we&apos;ll reach out for feedback now and then - and if it&apos;s working for you, we&apos;d love a testimonial down the track.
            </p>
          </div>

          {error && (
            <div className="bg-[var(--red-bg)] border border-red-200 rounded-xl px-4 py-3 text-[13px] text-[var(--red)] font-semibold mb-4">
              {error}
            </div>
          )}

          <button onClick={finish} disabled={saving} className="btn-primary mb-3">
            {saving ? "Setting up your account..." : "Next: set your material prices"}
          </button>

          <button onClick={() => setStep(1)} className="btn-secondary w-full justify-center">
            Back
          </button>

          <p className="text-center text-[12px] text-[var(--ink-faint)] mt-4">
            After this you will set your supplier prices - then you are ready to quote
          </p>
        </div>
      </div>
    </div>
  );
}
