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
  logo_url?: string | null;
  abn?: string | null;
  license_number?: string | null;
  business_address?: string | null;
  terms_and_conditions?: string | null;
} | null;

export default function SettingsPanel({ profile }: { profile: Profile }) {
  const [trades, setTrades] = useState<string[]>(profile?.trades ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [abn, setAbn] = useState(profile?.abn ?? "");
  const [licenseNumber, setLicenseNumber] = useState(profile?.license_number ?? "");
  const [businessAddress, setBusinessAddress] = useState(profile?.business_address ?? "");
  const [terms, setTerms] = useState(profile?.terms_and_conditions ?? "");
  const [logoPreview, setLogoPreview] = useState<string | null>(profile?.logo_url ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

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

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function saveCompanyDetails() {
    setCompanySaving(true);
    setCompanyError(null);
    setCompanySaved(false);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setCompanyError("Not signed in");
      setCompanySaving(false);
      return;
    }
    const userId = userData.user.id;

    let logoUrl: string | undefined;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop() || "png";
      const path = `${userId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(path, logoFile, { upsert: true });
      if (uploadError) {
        setCompanyError(`Logo upload failed: ${uploadError.message}`);
        setCompanySaving(false);
        return;
      }
      const { data: publicUrlData } = supabase.storage.from("logos").getPublicUrl(path);
      logoUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        abn: abn || null,
        license_number: licenseNumber || null,
        business_address: businessAddress || null,
        terms_and_conditions: terms,
        ...(logoUrl ? { logo_url: logoUrl } : {}),
      })
      .eq("id", userId);

    if (error) {
      setCompanyError(error.message);
    } else {
      setCompanySaved(true);
    }
    setCompanySaving(false);
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
        <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Branding</p>
        <p className="font-semibold text-[var(--ink)] mb-1">Company details</p>
        <p className="text-[13px] text-[var(--ink-faint)] mb-4">Shows up on every quote you send.</p>

        <div className="space-y-3">
          <label className="block">
            <span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">Logo</span>
            <div className="flex items-center gap-3">
              {logoPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo preview" className="w-12 h-12 object-contain rounded-lg border border-[var(--line)] bg-white" />
              )}
              <input type="file" accept="image/*" onChange={handleLogoChange} className="text-sm flex-1" />
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">ABN</span>
              <input value={abn} onChange={(e) => setAbn(e.target.value)} className="app-field" />
            </label>
            <label className="block">
              <span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">Licence number</span>
              <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="app-field" />
            </label>
          </div>

          <label className="block">
            <span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">Business address</span>
            <input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="app-field" />
          </label>

          <label className="block">
            <span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">Terms and conditions</span>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={4} className="app-field" />
          </label>
        </div>

        {companyError && <p className="text-[13px] text-red-600 mt-3">{companyError}</p>}
        {companySaved && <p className="text-[13px] text-green-700 mt-3">Saved</p>}

        <button
          onClick={saveCompanyDetails}
          disabled={companySaving}
          className="mt-4 bg-[var(--navy)] text-white rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {companySaving ? "Saving..." : "Save company details"}
        </button>
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
