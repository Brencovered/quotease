"use client";

import { useState } from "react";
import {
  Globe, Search, Check, AlertTriangle, Image as ImageIcon,
  Phone, MapPin, Briefcase, FileText, RefreshCw, ExternalLink,
  Building2, X,
} from "lucide-react";

interface ScrapeResult {
  action: "created" | "updated";
  id: string;
  slug: string | null;
  extracted: {
    business_name: string | null;
    trades: string[];
    suburb: string | null;
    postcode: string | null;
    state: string | null;
    phone: string | null;
    logo: boolean;
    blurb: boolean;
    photos: number;
  };
}

export default function AdminManualScraper() {
  const [url,       setUrl]       = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<ScrapeResult | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  async function scrape() {
    const trimmed = url.trim();
    if (!trimmed) return;
    const withProto = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;

    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch("/api/admin/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: withProto, overwrite }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Scrape failed"); }
      else setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setUrl(""); setResult(null); setError(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[1.6rem] text-[var(--ink)]">Manual URL scraper</h2>
        <p className="text-[13.5px] text-[var(--ink-soft)] mt-0.5">
          Drop any Australian trade business website URL and create or update a directory listing automatically.
        </p>
      </div>

      {/* Input */}
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

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <div
            onClick={() => setOverwrite(o => !o)}
            className={`w-9 h-5 rounded-full transition-colors cursor-pointer ${overwrite ? "bg-[var(--navy)]" : "bg-[var(--line)]"}`}
          >
            <div className={`w-3.5 h-3.5 bg-white rounded-full mt-0.5 transition-transform ${overwrite ? "translate-x-4.5" : "translate-x-0.5"}`} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[var(--ink)]">Overwrite existing data</p>
            <p className="text-[11.5px] text-[var(--ink-faint)]">If a listing already exists, replace all fields. Off = only fill empty fields.</p>
          </div>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[13.5px] text-red-800">Scrape failed</p>
            <p className="text-[12.5px] text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Status banner */}
          <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
            result.action === "created"
              ? "bg-green-50 border-green-200"
              : "bg-blue-50 border-blue-200"
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
              {result.extracted.business_name && (
                <p className={`text-[13px] ${result.action === "created" ? "text-green-700" : "text-blue-700"}`}>
                  {result.extracted.business_name}
                </p>
              )}
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

          {/* Extracted fields */}
          <div className="card">
            <p className="section-tag mb-3">What was extracted</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

              {/* Business name */}
              <div className="flex items-start gap-2.5 bg-[var(--app-bg)] rounded-xl p-3">
                <Building2 size={14} className="text-[var(--amber-deep)] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">Business name</p>
                  <p className="text-[13px] font-semibold text-[var(--ink)] truncate mt-0.5">
                    {result.extracted.business_name ?? <span className="text-[var(--ink-faint)] italic">not found</span>}
                  </p>
                </div>
              </div>

              {/* Trades */}
              <div className="flex items-start gap-2.5 bg-[var(--app-bg)] rounded-xl p-3">
                <Briefcase size={14} className="text-[var(--amber-deep)] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">Trades detected</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.extracted.trades.map(t => (
                      <span key={t} className="text-[10.5px] font-bold capitalize bg-[var(--navy)]/10 text-[var(--navy)] px-1.5 py-0.5 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-2.5 bg-[var(--app-bg)] rounded-xl p-3">
                <MapPin size={14} className="text-[var(--amber-deep)] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">Location</p>
                  <p className="text-[13px] font-semibold text-[var(--ink)] mt-0.5">
                    {[result.extracted.suburb, result.extracted.postcode, result.extracted.state].filter(Boolean).join(" ") || <span className="text-[var(--ink-faint)] italic">not found</span>}
                  </p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-2.5 bg-[var(--app-bg)] rounded-xl p-3">
                <Phone size={14} className="text-[var(--amber-deep)] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">Phone</p>
                  <p className="text-[13px] font-semibold text-[var(--ink)] mt-0.5">
                    {result.extracted.phone ?? <span className="text-[var(--ink-faint)] italic">not found</span>}
                  </p>
                </div>
              </div>

              {/* Photos */}
              <div className="flex items-start gap-2.5 bg-[var(--app-bg)] rounded-xl p-3">
                <ImageIcon size={14} className="text-[var(--amber-deep)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">Photos stored</p>
                  <p className={`text-[13px] font-semibold mt-0.5 ${result.extracted.photos > 0 ? "text-green-600" : "text-[var(--ink-faint)] italic"}`}>
                    {result.extracted.photos > 0 ? `${result.extracted.photos} photo${result.extracted.photos !== 1 ? "s" : ""}` : "none found"}
                  </p>
                </div>
              </div>

              {/* Blurb / Logo */}
              <div className="flex items-start gap-2.5 bg-[var(--app-bg)] rounded-xl p-3">
                <FileText size={14} className="text-[var(--amber-deep)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">Content</p>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full ${result.extracted.blurb ? "bg-green-50 text-green-700" : "bg-[var(--line)] text-[var(--ink-faint)]"}`}>
                      {result.extracted.blurb ? "✓ Description" : "No description"}
                    </span>
                    <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full ${result.extracted.logo ? "bg-green-50 text-green-700" : "bg-[var(--line)] text-[var(--ink-faint)]"}`}>
                      {result.extracted.logo ? "✓ Logo" : "No logo"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scrape another */}
          <button onClick={reset} className="btn-secondary w-full justify-center">
            Scrape another URL
          </button>
        </div>
      )}

      {/* How it works */}
      {!result && !error && (
        <div className="bg-[var(--app-bg)] border border-[var(--line)] rounded-2xl px-4 py-3">
          <p className="font-bold text-[13px] text-[var(--ink)] mb-2">What gets extracted</p>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] text-[var(--ink-soft)]">
            {[
              ["Business name",    "og:site_name, title tag, h1"],
              ["Trade detection",  "Keywords scanned across page content"],
              ["Suburb + postcode","JSON-LD address data, text patterns"],
              ["Phone number",     "tel: links, AU number patterns"],
              ["Logo",             "apple-touch-icon, img[alt*=logo], favicon"],
              ["Description",      "meta description, about section text"],
              ["Photos",           "og:image, hero images, gallery (stored to Supabase)"],
              ["Existing listings","Matched by website URL, updates or creates"],
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
