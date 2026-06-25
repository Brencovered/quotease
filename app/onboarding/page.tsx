"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";
import { PLUMBER_DEFAULT_MATERIALS } from "@/lib/calcPlumber";
import { CARPENTER_DEFAULT_MATERIALS } from "@/lib/calcCarpenter";
import { ROOFER_DEFAULT_MATERIALS } from "@/lib/calcRoofer";

const TRADES = [
  { key: "electrician", label: "Electrician", emoji: "⚡", ready: true },
  { key: "plumber",     label: "Plumber",     emoji: "🔧", ready: true },
  { key: "carpenter",   label: "Carpenter",   emoji: "🪚", ready: true },
  { key: "roofer",      label: "Roofer",      emoji: "🏠", ready: true },
];

const DEFAULT_TERMS =
  "Quote valid for 30 days. Materials and labour as listed above. Any variation to the scope of work will be quoted separately before proceeding. Payment due as per the terms stated on this quote.";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<string[]>([]);

  const [abn, setAbn] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function finish() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Not signed in");
      setSaving(false);
      return;
    }
    const userId = userData.user.id;

    let logoUrl: string | undefined;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop() || "png";
      const path = `${userId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(path, logoFile, { upsert: true });
      if (uploadError) {
        setError(`Logo upload failed: ${uploadError.message}`);
        setSaving(false);
        return;
      }
      const { data: publicUrlData } = supabase.storage.from("logos").getPublicUrl(path);
      logoUrl = publicUrlData.publicUrl;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        trades: selected,
        onboarded_at: new Date().toISOString(),
        abn: abn || null,
        license_number: licenseNumber || null,
        business_address: businessAddress || null,
        terms_and_conditions: terms,
        ...(logoUrl ? { logo_url: logoUrl } : {}),
      })
      .eq("id", userId);
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    const TRADE_SEED: Record<string, readonly { item_key: string; label: string; unit_cost: number }[]> = {
      electrician: ELECTRICIAN_DEFAULT_MATERIALS,
      plumber:     PLUMBER_DEFAULT_MATERIALS,
      carpenter:   CARPENTER_DEFAULT_MATERIALS,
      roofer:      ROOFER_DEFAULT_MATERIALS,
    };
    for (const t of selected) {
      const defaults = TRADE_SEED[t];
      if (!defaults) continue;
      const seedRows = defaults.map((m) => ({ profile_id: userId, trade: t, item_key: m.item_key, label: m.label, unit_cost: m.unit_cost }));
      await supabase.from("material_items").upsert(seedRows, { onConflict: "profile_id,item_key" });
    }

    setSaving(false);
    router.push("/electrician/dashboard");
    router.refresh();
  }

  if (step === 1) {
    return (
      <main className="max-w-md mx-auto px-6 py-16">
        <p className="font-display text-lg text-[var(--navy)] mb-6">QUOTEASE</p>
        <p className="text-[12px] font-bold tracking-wide text-[var(--amber-deep)] uppercase mb-1">Step 1 of 2</p>
        <h1 className="text-xl font-semibold text-[var(--ink)] mb-2">What trades do you do?</h1>
        <p className="text-sm text-[var(--ink-faint)] mb-6">Pick as many as apply. You can add more later in Settings.</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {TRADES.map((t) => {
            const isSelected = selected.includes(t.key);
            return (
              <button
                key={t.key}
                onClick={() => t.ready && toggle(t.key)}
                disabled={!t.ready}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 p-4 text-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                  isSelected ? "border-[var(--navy)] bg-[var(--navy)]" : "border-[var(--line)] bg-[var(--surface)]"
                }`}
              >
                <span className="text-2xl">{t.emoji}</span>
                <span className={`font-semibold text-sm ${isSelected ? "text-white" : "text-[var(--ink)]"}`}>{t.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setStep(2)}
          disabled={selected.length === 0}
          className="w-full bg-[var(--amber)] text-[var(--navy)] rounded-lg py-3 font-bold disabled:opacity-50"
        >
          Continue
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <p className="font-display text-lg text-[var(--navy)] mb-6">QUOTEASE</p>
      <p className="text-[12px] font-bold tracking-wide text-[var(--amber-deep)] uppercase mb-1">Step 2 of 2</p>
      <h1 className="text-xl font-semibold text-[var(--ink)] mb-2">Your company details</h1>
      <p className="text-sm text-[var(--ink-faint)] mb-6">
        This shows up on every quote you send. All optional — you can fill it in later from Settings.
      </p>

      <div className="space-y-4">
        <label className="block">
          <span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">Logo</span>
          <div className="flex items-center gap-3">
            {logoPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo preview" className="w-14 h-14 object-contain rounded-lg border border-[var(--line)] bg-white" />
            )}
            <input type="file" accept="image/*" onChange={handleLogoChange} className="text-sm flex-1" />
          </div>
        </label>

        <label className="block">
          <span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">ABN</span>
          <input value={abn} onChange={(e) => setAbn(e.target.value)} className="app-field" placeholder="11 222 333 444" />
        </label>

        <label className="block">
          <span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">Licence number</span>
          <input
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            className="app-field"
            placeholder="e.g. electrical contractor licence"
          />
        </label>

        <label className="block">
          <span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">Business address</span>
          <input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="app-field" />
        </label>

        <label className="block">
          <span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">Terms and conditions</span>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={5}
            className="app-field"
          />
          <span className="block text-[12px] text-[var(--ink-faint)] mt-1">Sent at the bottom of every quote email.</span>
        </label>
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex gap-3 mt-6">
        <button onClick={() => setStep(1)} className="flex-1 border-2 border-[var(--line)] text-[var(--ink)] rounded-lg py-3 font-semibold text-sm">
          Back
        </button>
        <button
          onClick={finish}
          disabled={saving}
          className="flex-1 bg-[var(--amber)] text-[var(--navy)] rounded-lg py-3 font-bold text-sm disabled:opacity-50"
        >
          {saving ? "Setting up..." : "Finish setup"}
        </button>
      </div>
    </main>
  );
}
