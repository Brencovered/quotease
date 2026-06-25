"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TRADES = [
  { key: "electrician", label: "Electrician", ready: true },
  { key: "plumber", label: "Plumber", ready: false },
  { key: "carpenter", label: "Carpenter", ready: false },
  { key: "tiler", label: "Tiler", ready: false },
];

type Profile = {
  business_name?: string;
  contact_email?: string;
  xero_connected?: boolean;
  trades?: string[];
} | null;

export default function SettingsPanel({ profile }: { profile: Profile }) {
  const [trades, setTrades] = useState<string[]>(profile?.trades ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function toggle(key: string) {
    const next = trades.includes(key) ? trades.filter((t) => t !== key) : [...trades, key];
    setTrades(next);
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase.from("profiles").update({ trades: next }).eq("id", userData.user.id);
    }
    setSaving(false);
    setSaved(true);
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-16">
      <h1 className="font-display text-2xl text-[var(--ink)] mb-5">Settings</h1>

      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5 mb-4">
        <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Trades</p>
        <p className="font-semibold text-[var(--ink)] mb-1">Your trades</p>
        <p className="text-[13px] text-[var(--ink-faint)] mb-3">Toggle which trades show up in your account.</p>
        <div className="grid grid-cols-2 gap-2">
          {TRADES.map((t) => {
            const isSelected = trades.includes(t.key);
            return (
              <button
                key={t.key}
                onClick={() => t.ready && toggle(t.key)}
                disabled={!t.ready || saving}
                className={`text-left rounded-lg border-2 p-3 text-sm font-semibold disabled:opacity-40 transition-colors ${
                  isSelected ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink)]"
                }`}
              >
                {t.label}
                {!t.ready && <span className="text-xs text-[var(--ink-faint)] block font-normal">Coming soon</span>}
              </button>
            );
          })}
        </div>
        {saved && <p className="text-[13px] text-green-700 mt-2">Saved</p>}
      </div>

      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5 mb-4">
        <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Accounting</p>
        {profile?.xero_connected ? (
          <p className="text-sm text-green-700 font-semibold">Connected to Xero</p>
        ) : (
          <>
            <p className="text-[13px] text-[var(--ink-faint)] mb-3">
              Optional — most tradies use the free CSV export from the Quotes page instead. Only
              connect this if you specifically want automatic invoice sync.
            </p>
            <a href="/api/xero/connect" className="inline-block bg-[var(--navy)] text-white rounded-lg px-4 py-2.5 text-sm font-semibold">
              Connect Xero
            </a>
          </>
        )}
      </div>

      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5">
        <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Business</p>
        <p className="text-sm text-[var(--ink)] font-semibold">{profile?.business_name ?? "Not signed in — demo view"}</p>
        <p className="text-sm text-[var(--ink-faint)]">{profile?.contact_email ?? ""}</p>
      </div>
    </main>
  );
}
