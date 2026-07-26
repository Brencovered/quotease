"use client";

import { useState } from "react";
import {
  Globe, Search, Check, AlertTriangle, Image as ImageIcon,
  Phone, MapPin, Briefcase, FileText, RefreshCw, ExternalLink,
  Building2, X, Plus, Trash2, Pencil,
} from "lucide-react";

interface License {
  type: string;
  number: string;
}

interface EditableFields {
  business_name: string | null;
  website_url: string;
  logo_url: string | null;
  blurb: string | null;
  phone: string | null;
  suburb: string | null;
  postcode: string | null;
  state: string | null;
  trades: string[];
  facebook_url: string | null;
  instagram_url: string | null;
  years_experience: number | null;
  licenses: License[];
  services_offered: string[];
  photo_urls: string[];
}

interface PreviewResponse {
  mode: "preview";
  existingListingId: string | null;
  existingBusinessName: string | null;
  fields: EditableFields;
}

interface ConfirmResponse {
  action: "created" | "updated";
  id: string;
  slug: string | null;
}

function emptyFields(url: string): EditableFields {
  return {
    business_name: null, website_url: url, logo_url: null, blurb: null,
    phone: null, suburb: null, postcode: null, state: null, trades: [],
    facebook_url: null, instagram_url: null, years_experience: null,
    licenses: [], services_offered: [], photo_urls: [],
  };
}

export default function AdminManualScraper() {
  const [url,       setUrl]       = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Review step -- populated after a scrape, before anything is saved.
  const [preview,   setPreview]   = useState<PreviewResponse | null>(null);
  const [fields,    setFields]    = useState<EditableFields | null>(null);
  const [result,    setResult]    = useState<ConfirmResponse | null>(null);

  async function scrape() {
    const trimmed = url.trim();
    if (!trimmed) return;
    const withProto = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;

    setLoading(true); setPreview(null); setFields(null); setResult(null); setError(null);
    try {
      const res = await fetch("/api/admin/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: withProto }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Scrape failed");
      } else {
        setPreview(data as PreviewResponse);
        setFields((data as PreviewResponse).fields ?? emptyFields(withProto));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!fields) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/admin/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "confirm", fields, overwrite }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
      } else {
        setResult(data as ConfirmResponse);
        setPreview(null);
        setFields(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setUrl(""); setPreview(null); setFields(null); setResult(null); setError(null);
  }

  function updateField<K extends keyof EditableFields>(key: K, value: EditableFields[K]) {
    setFields((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function removePhoto(idx: number) {
    setFields((prev) => (prev ? { ...prev, photo_urls: prev.photo_urls.filter((_, i) => i !== idx) } : prev));
  }

  function updateLicense(idx: number, patch: Partial<License>) {
    setFields((prev) => {
      if (!prev) return prev;
      const licenses = prev.licenses.map((l, i) => (i === idx ? { ...l, ...patch } : l));
      return { ...prev, licenses };
    });
  }

  function addLicense() {
    setFields((prev) => (prev ? { ...prev, licenses: [...prev.licenses, { type: "", number: "" }] } : prev));
  }

  function removeLicense(idx: number) {
    setFields((prev) => (prev ? { ...prev, licenses: prev.licenses.filter((_, i) => i !== idx) } : prev));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[1.6rem] text-[var(--ink)]">Manual URL scraper</h2>
        <p className="text-[13.5px] text-[var(--ink-soft)] mt-0.5">
          Drop any Australian trade business website URL, review and correct what was found, then confirm to
          create or update the directory listing. Nothing is saved until you confirm.
        </p>
      </div>

      {/* Input -- only shown before a preview exists */}
      {!preview && !result && (
        <div className="card space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-2">Website URL</p>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-white border-2 border-[var(--line)] focus-within:border-[var(--navy)] rounded-xl px-3.5 py-2.5 transition-colors">
                <Globe size={15} className="text-[var(--ink-faint)] shrink-0" />
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") scrape(); }}
                  placeholder="https://smithelectrical.com.au"
                  className="flex-1 text-[14px] text-[var(--ink)] bg-transparent focus:outline-none placeholder:text-[var(--ink-faint)]"
                  disabled={loading}
                />
                {url && (
                  <button onClick={() => setUrl("")} className="text-[var(--ink-faint)] hover:text-[var(--red)] border-0 bg-transparent p-0.5">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={scrape}
                disabled={!url.trim() || loading}
                className="btn-primary px-5 shrink-0 disabled:opacity-40"
              >
                {loading
                  ? <><RefreshCw size={14} className="animate-spin" /> Scraping...</>
                  : <><Search size={14} /> Scrape</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[13.5px] text-red-800">{preview ? "Save failed" : "Scrape failed"}</p>
            <p className="text-[12.5px] text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Review + edit step -- nothing has been saved yet */}
      {preview && fields && (
        <div className="space-y-4">
          {preview.existingListingId && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
              <RefreshCw size={16} className="text-blue-700 shrink-0" />
              <p className="text-[13px] text-blue-800">
                <span className="font-bold">Existing listing found</span> ({preview.existingBusinessName}) --
                confirming will update it, not create a duplicate.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <Pencil size={15} className="text-[var(--amber-deep)] shrink-0" />
            <p className="text-[13px] text-[var(--amber-deep)] font-semibold">
              Review and correct anything below before confirming -- nothing has been saved to the directory yet.
            </p>
          </div>

          <div className="card space-y-4">
            <p className="section-tag">Business details</p>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Business name" icon={Building2}>
                <input
                  value={fields.business_name ?? ""}
                  onChange={e => updateField("business_name", e.target.value || null)}
                  className="app-field"
                  placeholder="Not found -- enter manually"
                />
              </Field>

              <Field label="Phone" icon={Phone}>
                <input
                  value={fields.phone ?? ""}
                  onChange={e => updateField("phone", e.target.value || null)}
                  className="app-field"
                  placeholder="Not found -- enter manually"
                />
              </Field>

              <Field label="Suburb" icon={MapPin}>
                <input
                  value={fields.suburb ?? ""}
                  onChange={e => updateField("suburb", e.target.value || null)}
                  className="app-field"
                />
              </Field>

              <Field label="Postcode">
                <input
                  value={fields.postcode ?? ""}
                  onChange={e => updateField("postcode", e.target.value || null)}
                  className="app-field"
                  inputMode="numeric"
                  maxLength={4}
                />
              </Field>

              <Field label="State">
                <input
                  value={fields.state ?? ""}
                  onChange={e => updateField("state", e.target.value.toUpperCase() || null)}
                  className="app-field"
                  placeholder="e.g. VIC"
                  maxLength={3}
                />
              </Field>

              <Field label="Logo URL" icon={ImageIcon}>
                <input
                  value={fields.logo_url ?? ""}
                  onChange={e => updateField("logo_url", e.target.value || null)}
                  className="app-field"
                  placeholder="Not found -- paste a URL"
                />
              </Field>
            </div>

            <Field label="Trades (comma separated)" icon={Briefcase}>
              <input
                value={fields.trades.join(", ")}
                onChange={e => updateField("trades", e.target.value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean))}
                className="app-field"
                placeholder="e.g. electrician, aircon"
              />
            </Field>

            <Field label="Description" icon={FileText}>
              <textarea
                value={fields.blurb ?? ""}
                onChange={e => updateField("blurb", e.target.value || null)}
                className="app-field min-h-[80px]"
                placeholder="Not found -- write a short description"
              />
            </Field>

            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Facebook URL">
                <input
                  value={fields.facebook_url ?? ""}
                  onChange={e => updateField("facebook_url", e.target.value || null)}
                  className="app-field"
                />
              </Field>
              <Field label="Instagram URL">
                <input
                  value={fields.instagram_url ?? ""}
                  onChange={e => updateField("instagram_url", e.target.value || null)}
                  className="app-field"
                />
              </Field>
              <Field label="Years experience">
                <input
                  type="number"
                  value={fields.years_experience ?? ""}
                  onChange={e => updateField("years_experience", e.target.value ? Number(e.target.value) : null)}
                  className="app-field"
                />
              </Field>
            </div>

            <Field label="Services offered (one per line)">
              <textarea
                value={fields.services_offered.join("\n")}
                onChange={e => updateField("services_offered", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                className="app-field min-h-[100px]"
                placeholder="Not found"
              />
            </Field>

            {/* Licences */}
            <div>
              <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-2">Licences / certifications</p>
              <div className="space-y-2">
                {fields.licenses.map((lic, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      value={lic.type}
                      onChange={e => updateLicense(i, { type: e.target.value })}
                      placeholder="Type, e.g. Electrical Contractor Licence"
                      className="app-field flex-1"
                    />
                    <input
                      value={lic.number}
                      onChange={e => updateLicense(i, { number: e.target.value })}
                      placeholder="Number (optional)"
                      className="app-field w-40"
                    />
                    <button onClick={() => removeLicense(i)} className="text-[var(--ink-faint)] hover:text-red-600 border-0 bg-transparent p-1.5 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button onClick={addLicense} className="btn-secondary text-[12.5px] py-1.5 px-3 flex items-center gap-1.5">
                  <Plus size={13} /> Add licence
                </button>
              </div>
            </div>

            {/* Photos */}
            {fields.photo_urls.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-2">
                  Photos ({fields.photo_urls.length}) -- remove any that don&apos;t belong
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {fields.photo_urls.map((src, i) => (
                    <div key={src + i} className="relative aspect-square rounded-lg overflow-hidden bg-[var(--app-bg)] border border-[var(--line)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div
              onClick={() => setOverwrite(o => !o)}
              className={`w-9 h-5 rounded-full transition-colors cursor-pointer ${overwrite ? "bg-[var(--navy)]" : "bg-[var(--line)]"}`}
            >
              <div className={`w-3.5 h-3.5 bg-white rounded-full mt-0.5 transition-transform ${overwrite ? "translate-x-4.5" : "translate-x-0.5"}`} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--ink)]">Overwrite existing data</p>
              <p className="text-[11.5px] text-[var(--ink-faint)]">If a listing already exists, replace all fields with what&apos;s above. Off = only fill empty fields.</p>
            </div>
          </label>

          <div className="flex gap-2">
            <button onClick={reset} className="btn-secondary flex-1 justify-center" disabled={saving}>
              Cancel
            </button>
            <button onClick={confirm} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : <><Check size={14} /> Confirm and save</>}
            </button>
          </div>
        </div>
      )}

      {/* Confirmed result */}
      {result && (
        <div className="space-y-4">
          <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
            result.action === "created" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"
          }`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              result.action === "created" ? "bg-green-100" : "bg-blue-100"
            }`}>
              {result.action === "created"
                ? <Building2 size={16} className="text-green-700" />
                : <RefreshCw size={16} className="text-blue-700" />}
            </div>
            <div className="flex-1">
              <p className={`font-bold text-[14px] ${result.action === "created" ? "text-green-800" : "text-blue-800"}`}>
                {result.action === "created" ? "New listing created" : "Existing listing updated"}
              </p>
            </div>
            <a
              href={result.slug ? `/directory/${result.slug}` : `/admin/directory`}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-1 text-[12px] font-semibold shrink-0 ${
                result.action === "created" ? "text-green-700 hover:text-green-900" : "text-blue-700 hover:text-blue-900"
              }`}
            >
              {result.slug ? "View live listing" : "View in directory"} <ExternalLink size={11} />
            </a>
          </div>

          <button onClick={reset} className="btn-secondary w-full justify-center">
            Scrape another URL
          </button>
        </div>
      )}

      {/* How it works */}
      {!preview && !result && !error && (
        <div className="bg-[var(--app-bg)] border border-[var(--line)] rounded-2xl px-4 py-3">
          <p className="font-bold text-[13px] text-[var(--ink)] mb-2">What gets extracted (and can be edited before saving)</p>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] text-[var(--ink-soft)]">
            {[
              ["Business name",    "og:site_name, title tag, h1"],
              ["Trade detection",  "Keywords scanned across page content"],
              ["Suburb + postcode","JSON-LD address data, text patterns"],
              ["Phone number",     "tel: links, AU number patterns"],
              ["Logo",             "apple-touch-icon, img[alt*=logo], favicon"],
              ["Description",      "meta description, about section text"],
              ["Photos",           "og:image, hero images, gallery"],
              ["Social media",     "Facebook and Instagram profile links"],
              ["Years experience", "Established year, \"X years experience\" patterns"],
              ["Licences",         "QBCC, VBA, Master Electricians, ABN, contractor licences"],
              ["Services",         "Services page + homepage service lists (up to 12 items)"],
              ["Existing listings","Matched by website URL -- you'll confirm update vs create"],
            ].map(([label, src]) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <Check size={11} className="text-[var(--amber-deep)] shrink-0 mt-0.5" />
                <span><span className="font-semibold text-[var(--ink)]">{label}:</span> {src}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon?: typeof Building2; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon size={11} />} {label}
      </p>
      {children}
    </div>
  );
}
