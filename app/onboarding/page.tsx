"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";

const TRADES = [
  { key: "electrician", label: "Electrician", ready: true },
  { key: "plumber", label: "Plumber", ready: false },
  { key: "carpenter", label: "Carpenter", ready: false },
  { key: "tiler", label: "Tiler", ready: false },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
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

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ trades: selected, onboarded_at: new Date().toISOString() })
      .eq("id", userData.user.id);
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    // Seed the materials price book for any ready trade they picked.
    // Electrician is the only one with real defaults right now — the rest
    // get an empty library until that trade's calculator is built.
    if (selected.includes("electrician")) {
      const seedRows = ELECTRICIAN_DEFAULT_MATERIALS.map((m) => ({
        profile_id: userData.user!.id,
        trade: "electrician",
        item_key: m.item_key,
        label: m.label,
        unit_cost: m.unit_cost,
      }));
      await supabase.from("material_items").upsert(seedRows, { onConflict: "profile_id,item_key" });
    }

    setSaving(false);
    router.push("/electrician");
    router.refresh();
  }

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-xl font-medium mb-2">What trades do you do?</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Pick as many as apply. You can add more later in Settings.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {TRADES.map((t) => {
          const isSelected = selected.includes(t.key);
          return (
            <button
              key={t.key}
              onClick={() => t.ready && toggle(t.key)}
              disabled={!t.ready}
              className={`flex flex-col items-center gap-1 rounded-lg border-2 p-4 text-left disabled:opacity-40 disabled:cursor-not-allowed ${
                isSelected ? "border-blue-500 bg-blue-50" : "border-neutral-200"
              }`}
            >
              <span className={`font-medium text-sm ${isSelected ? "text-blue-900" : ""}`}>{t.label}</span>
              <span className="text-xs text-neutral-500">{t.ready ? "Ready now" : "Coming soon"}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <button
        onClick={finish}
        disabled={saving || selected.length === 0}
        className="w-full bg-blue-600 text-white rounded-md py-2 font-medium disabled:opacity-50"
      >
        {saving ? "Setting up..." : "Continue"}
      </button>
    </main>
  );
}
