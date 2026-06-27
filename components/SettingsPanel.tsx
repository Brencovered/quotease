"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FREE_ANALYSES_LIMIT, ADDON_MONTHLY_LIMIT, currentPeriod } from "@/lib/aiUsage";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";
import { PLUMBER_DEFAULT_MATERIALS } from "@/lib/calcPlumber";
import { CARPENTER_DEFAULT_MATERIALS } from "@/lib/calcCarpenter";
import { ROOFER_DEFAULT_MATERIALS } from "@/lib/calcRoofer";
import { Check, Upload } from "lucide-react";
import { normalizeToPng } from "@/lib/imageNormalize";

const TRADE_SEED: Record<string, readonly { item_key: string; label: string; unit_cost: number }[]> = {
  electrician: ELECTRICIAN_DEFAULT_MATERIALS,
  plumber:     PLUMBER_DEFAULT_MATERIALS,
  carpenter:   CARPENTER_DEFAULT_MATERIALS,
  roofer:      ROOFER_DEFAULT_MATERIALS,
};

const TRADES = [
  { key: "electrician", label: "Electrician", emoji: "⚡" },
  { key: "plumber",     label: "Plumber",     emoji: "🔧" },
  { key: "carpenter",   label: "Carpenter",   emoji: "🪚" },
  { key: "roofer",      label: "Roofer",      emoji: "🏠" },
];

type Profile = {
  business_name?: string; contact_email?: string; xero_connected?: boolean;
  trades?: string[]; logo_url?: string | null; abn?: string | null;
  license_number?: string | null; business_address?: string | null;
  terms_and_conditions?: string | null; ai_free_analyses_used?: number;
  ai_addon_status?: string; ai_addon_period?: string | null; ai_addon_analyses_used?: number;
  bank_account_name?: string | null; bank_bsb?: string | null; bank_account_number?: string | null;
  accepts_cash?: boolean;
  default_deposit_pct?: number | null;
  default_expiry_days?: number;
} | null;

export default function SettingsPanel({ profile }: { profile: Profile }) {
  const [trades,         setTrades]         = useState<string[]>(profile?.trades ?? []);
  const [tradeSaving,    setTradeSaving]    = useState(false);
  const [tradeSaved,     setTradeSaved]     = useState(false);

  const [abn,            setAbn]            = useState(profile?.abn ?? "");
  const [licenceNumber,  setLicenceNumber]  = useState(profile?.license_number ?? "");
  const [businessAddress,setBusinessAddress] = useState(profile?.business_address ?? "");
  const [terms,          setTerms]          = useState(profile?.terms_and_conditions ?? "");
  const [bankAccountName, setBankAccountName] = useState(profile?.bank_account_name ?? "");
  const [bankBsb,          setBankBsb]          = useState(profile?.bank_bsb ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState(profile?.bank_account_number ?? "");
  const [acceptsCash,      setAcceptsCash]      = useState(profile?.accepts_cash ?? true);
  const [defaultDepositPct, setDefaultDepositPct] = useState<number | null>(profile?.default_deposit_pct ?? null);
  const [defaultExpiryDays, setDefaultExpiryDays] = useState(profile?.default_expiry_days ?? 30);
  const [logoPreview,    setLogoPreview]    = useState<string | null>(profile?.logo_url ?? null);
  const [logoFile,       setLogoFile]       = useState<File | null>(null);
  const [companySaving,  setCompanySaving]  = useState(false);
  const [companySaved,   setCompanySaved]   = useState(false);
  const [companyError,   setCompanyError]   = useState<string | null>(null);

  async function toggle(key: string) {
    const adding = !trades.includes(key);
    const next   = adding ? [...trades, key] : trades.filter((t) => t !== key);
    setTrades(next); setTradeSaving(true); setTradeSaved(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ trades: next }).eq("id", user.id);
      if (adding && TRADE_SEED[key]) {
        await supabase.from("material_items").upsert(
          TRADE_SEED[key].map((m) => ({ profile_id: user.id, trade: key, item_key: m.item_key, label: m.label, unit_cost: m.unit_cost })),
          { onConflict: "profile_id,item_key" }
        );
      }
    }
    setTradeSaving(false); setTradeSaved(true);
    setTimeout(() => setTradeSaved(false), 2000);
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setLogoFile(file); setLogoPreview(URL.createObjectURL(file));
  }

  async function saveCompanyDetails() {
    setCompanySaving(true); setCompanyError(null); setCompanySaved(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCompanyError("Not signed in"); setCompanySaving(false); return; }

    let logoUrl: string | undefined;
    if (logoFile) {
      try {
        const pngFile = await normalizeToPng(logoFile);
        const path = `${user.id}/logo.png`;
        const { error: upErr } = await supabase.storage.from("logos").upload(path, pngFile, { upsert: true });
        if (upErr) { setCompanyError(`Logo upload failed: ${upErr.message}`); setCompanySaving(false); return; }
        const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
        logoUrl = pub.publicUrl;
      } catch (err) {
        setCompanyError(err instanceof Error ? err.message : "Could not process this logo image.");
        setCompanySaving(false);
        return;
      }
    }

    const { error } = await supabase.from("profiles").update({
      abn: abn || null, license_number: licenceNumber || null,
      business_address: businessAddress || null, terms_and_conditions: terms,
      bank_account_name: bankAccountName || null, bank_bsb: bankBsb || null,
      bank_account_number: bankAccountNumber || null, accepts_cash: acceptsCash,
      default_deposit_pct: defaultDepositPct, default_expiry_days: defaultExpiryDays,
      ...(logoUrl ? { logo_url: logoUrl } : {}),
    }).eq("id", user.id);

    if (error) setCompanyError(error.message);
    else { setCompanySaved(true); setTimeout(() => setCompanySaved(false), 2000); }
    setCompanySaving(false);
  }

  const freeUsed   = profile?.ai_free_analyses_used ?? 0;
  const freeLeft   = Math.max(FREE_ANALYSES_LIMIT - freeUsed, 0);
  const addonActive = profile?.ai_addon_status === "active";
  const addonUsed  = profile?.ai_addon_period === currentPeriod() ? (profile?.ai_addon_analyses_used ?? 0) : 0;

  return (
    <div className="page-wrap-narrow">
      <h1 className="font-display text-[28px] text-[var(--ink)] mb-6">Settings</h1>

      {/* Account summary */}
      <div className="card mb-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-[var(--navy)] flex items-center justify-center font-display text-[var(--amber)] text-lg shrink-0">
          {(profile?.business_name ?? profile?.contact_email ?? "?")[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-[var(--ink)] text-[15px] truncate">{profile?.business_name ?? "Your business"}</p>
          <p className="text-[13px] text-[var(--ink-faint)] truncate">{profile?.contact_email ?? ""}</p>
        </div>
      </div>

      {/* Trades */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="section-tag">Trades</p>
          {tradeSaving && <span className="text-[12px] text-[var(--ink-faint)]">Saving...</span>}
          {tradeSaved  && <span className="text-[12px] text-[var(--green)] font-semibold flex items-center gap-1"><Check size={12}/>Saved</span>}
        </div>
        <p className="font-semibold text-[var(--ink)] mb-1">Your active trades</p>
        <p className="text-[13px] text-[var(--ink-faint)] mb-3">Toggle trades on or off. Default material prices are loaded automatically.</p>
        <div className="grid grid-cols-2 gap-2">
          {TRADES.map((t) => {
            const on = trades.includes(t.key);
            return (
              <button key={t.key} onClick={() => !tradeSaving && toggle(t.key)} disabled={tradeSaving}
                className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-3 font-semibold transition-colors ${
                  on ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--navy)]/40"
                }`}>
                <span className="text-xl">{t.emoji}</span>
                <span className="text-[14px]">{t.label}</span>
                {on && <Check size={13} className="ml-auto text-[var(--amber)]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Company branding */}
      <div className="card mb-4">
        <p className="section-tag mb-1">Branding</p>
        <p className="font-semibold text-[var(--ink)] mb-1">Company details</p>
        <p className="text-[13px] text-[var(--ink-faint)] mb-4">Appears on every quote you send to clients.</p>

        <div className="space-y-3">
          {/* Logo */}
          <div>
            <p className="text-[12.5px] font-semibold text-[var(--ink-soft)] mb-2">Logo</p>
            <div className="flex items-center gap-3">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo" className="w-14 h-14 object-contain rounded-xl border border-[var(--line)] bg-white" />
              ) : (
                <div className="w-14 h-14 rounded-xl border-2 border-dashed border-[var(--line)] bg-[var(--app-bg)] flex items-center justify-center text-[var(--ink-faint)]">
                  <Upload size={18} />
                </div>
              )}
              <label className="btn-secondary text-[13px] py-2 cursor-pointer">
                {logoPreview ? "Change logo" : "Upload logo"}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">ABN</label>
              <input value={abn} onChange={(e) => setAbn(e.target.value)} className="app-field" placeholder="11 222 333 444" />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Licence number</label>
              <input value={licenceNumber} onChange={(e) => setLicenceNumber(e.target.value)} className="app-field" placeholder="REC 23538" />
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Business address</label>
            <input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="app-field" placeholder="123 Main St, Suburb VIC 3000" />
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Quote terms and conditions</label>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={4} className="app-field text-[13px]" />
            <p className="text-[11.5px] text-[var(--ink-faint)] mt-1">Sent at the bottom of every quote email.</p>
          </div>

          <div className="border-t border-[var(--line)] pt-3 mt-1">
            <p className="text-[12.5px] font-semibold text-[var(--ink-soft)] mb-2">Quoting defaults</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[11.5px] text-[var(--ink-faint)] mb-1">Default deposit</span>
                <select value={defaultDepositPct ?? ""} onChange={(e) => setDefaultDepositPct(e.target.value ? Number(e.target.value) : null)} className="app-field text-[13px]">
                  <option value="">None — full on completion</option>
                  <option value="30">30% deposit</option>
                  <option value="50">50% deposit</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-[11.5px] text-[var(--ink-faint)] mb-1">Quote expires after</span>
                <select value={defaultExpiryDays} onChange={(e) => setDefaultExpiryDays(Number(e.target.value))} className="app-field text-[13px]">
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </label>
            </div>
            <p className="text-[11.5px] text-[var(--ink-faint)] mt-1.5">Applied to every new quote automatically — still editable per quote if needed.</p>
          </div>

          <div className="border-t border-[var(--line)] pt-3 mt-1">
            <p className="text-[12.5px] font-semibold text-[var(--ink-soft)] mb-2">How clients can pay you</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} className="app-field text-[13px]" placeholder="Account name" />
              <input value={bankBsb} onChange={(e) => setBankBsb(e.target.value)} className="app-field text-[13px]" placeholder="BSB" />
              <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className="app-field text-[13px]" placeholder="Account number" />
            </div>
            <label className="flex items-center gap-2 text-[13px] text-[var(--ink-soft)]">
              <input type="checkbox" checked={acceptsCash} onChange={(e) => setAcceptsCash(e.target.checked)} />
              Accept cash on completion
            </label>
            <p className="text-[11.5px] text-[var(--ink-faint)] mt-1">Shown to clients on the quote page and PDF. Card payments need Stripe Connect — ask if you want that built next.</p>
          </div>
        </div>

        {companyError  && <div className="bg-[var(--red-bg)] border border-red-200 rounded-xl px-3 py-2.5 text-[13px] text-[var(--red)] font-semibold mt-3">{companyError}</div>}

        <div className="flex items-center gap-3 mt-4">
          <button onClick={saveCompanyDetails} disabled={companySaving} className="btn-primary flex-1">
            {companySaving ? "Saving..." : "Save details"}
          </button>
          {companySaved && <span className="text-[13px] text-[var(--green)] font-semibold flex items-center gap-1"><Check size={13}/>Saved</span>}
        </div>
      </div>

      {/* Xero */}
      <div className="card mb-4">
        <p className="section-tag mb-1">Accounting</p>
        <p className="font-semibold text-[var(--ink)] mb-1">Xero integration</p>
        {profile?.xero_connected ? (
          <div className="flex items-center gap-2 text-[var(--green)] font-semibold text-[14px] mt-2">
            <Check size={15} /> Connected to Xero
          </div>
        ) : (
          <>
            <p className="text-[13px] text-[var(--ink-faint)] mb-3">
              Most tradies use the free CSV export on the Quotes page. Only connect this for automatic invoice sync.
            </p>
            <a href="/api/xero/connect" className="btn-secondary inline-flex text-[13px] py-2">
              Connect Xero
            </a>
          </>
        )}
      </div>

      {/* AI addon — lower priority */}
      <div className="card mb-4">
        <p className="section-tag mb-1">AI drawing analysis</p>
        <p className="font-semibold text-[var(--ink)] mb-1">Auto-fill from plans</p>
        {addonActive ? (
          <p className="text-[13px] text-[var(--ink-faint)]">
            {addonUsed} of {ADDON_MONTHLY_LIMIT} analyses used this month.
          </p>
        ) : (
          <p className="text-[13px] text-[var(--ink-faint)]">
            {freeLeft > 0
              ? `${freeLeft} free analysis${freeLeft !== 1 ? "es" : ""} remaining for now.`
              : `You've used your ${FREE_ANALYSES_LIMIT} free analyses for now.`}{" "}
            Free during early access — more capacity is coming.
          </p>
        )}
      </div>
    </div>
  );
}
