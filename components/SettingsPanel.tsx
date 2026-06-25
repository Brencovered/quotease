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
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-xl font-medium mb-6">Settings</h1>

      <div className="border rounded-lg p-4 mb-4">
        <p className="font-medium text-sm mb-1">Your trades</p>
        <p className="text-xs text-neutral-500 mb-3">Toggle which trades show up in your account.</p>
        <div className="grid grid-cols-2 gap-2">
          {TRADES.map((t) => {
            const isSelected = trades.includes(t.key);
            return (
              <button
                key={t.key}
                onClick={() => t.ready && toggle(t.key)}
                disabled={!t.ready || saving}
                className={`text-left rounded-md border-2 p-2 text-sm disabled:opacity-40 ${
                  isSelected ? "border-blue-500 bg-blue-50 text-blue-900" : "border-neutral-200"
                }`}
              >
                {t.label}
                {!t.ready && <span className="text-xs text-neutral-400 block">Coming soon</span>}
              </button>
            );
          })}
        </div>
        {saved && <p className="text-xs text-green-700 mt-2">Saved</p>}
      </div>

      <div className="border rounded-lg p-4 mb-4">
        <p className="font-medium text-sm mb-1">Accounting</p>
        {profile?.xero_connected ? (
          <p className="text-sm text-green-700">Connected to Xero</p>
        ) : (
          <>
            <p className="text-sm text-neutral-500 mb-3">
              Optional — most tradies use the free CSV export from the Quotes page instead. Only
              connect this if you specifically want automatic invoice sync.
            </p>
            <a
              href="/api/xero/connect"
              className="inline-block bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium"
            >
              Connect Xero
            </a>
          </>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <p className="font-medium text-sm mb-1">Business</p>
        <p className="text-sm text-neutral-500">{profile?.business_name ?? "Not signed in — demo view"}</p>
        <p className="text-sm text-neutral-500">{profile?.contact_email ?? ""}</p>
      </div>
    </main>
  );
}
