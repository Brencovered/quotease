"use client";

import { useState, useEffect } from "react";
import {
  Globe, Image as ImageIcon, FileText, Briefcase, Play,
  RefreshCw, Check, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";

interface Stats {
  total: number;
  withWebsite: number;
  withPhotos: number;
  withLogo: number;
  withBlurb: number;
  noWebsite: number;
}

interface RunResult {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  remaining: number;
  detail: string[];
  skipReasons?: Record<string, number>;
}

export default function AdminWebsiteScraper() {
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [running,   setRunning]   = useState(false);
  const [result,    setResult]    = useState<RunResult | null>(null);
  const [mode,      setMode]      = useState<"all" | "photos" | "logo" | "blurb">("all");
  const [showLog,   setShowLog]   = useState(false);
  const [autoRun,   setAutoRun]   = useState(false);
  const [runCount,  setRunCount]  = useState(0);

  async function loadStats() {
    const res = await fetch("/api/admin/scrape-websites");
    if (res.ok) setStats(await res.json());
  }

  useEffect(() => { loadStats(); }, []);

  async function runBatch() {
    setRunning(true);
    const res = await fetch("/api/admin/scrape-websites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data: RunResult = await res.json();
    setResult(data);
    setRunCount(c => c + 1);
    setRunning(false);
    loadStats();

    // Auto-run if enabled and there's more to do
    if (autoRun && data.remaining > 0) {
      setTimeout(runBatch, 2000);
    }
  }

  const pct = (n: number) => stats ? Math.round((n / stats.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[1.6rem] text-[var(--ink)]">Website scraper</h2>
        <p className="text-[13.5px] text-[var(--ink-soft)] mt-0.5">
          Pull photos, logos, and blurbs directly from each business&apos;s own website.
          Free, no Google API calls, and often better quality.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Have website",  val: stats.withWebsite, icon: Globe,      color: "text-blue-600"  },
            { label: "Photos cached", val: stats.withPhotos,  icon: ImageIcon,  color: "text-green-600" },
            { label: "Have logo",     val: stats.withLogo,    icon: Briefcase,  color: "text-amber-600" },
            { label: "Have blurb",    val: stats.withBlurb,   icon: FileText,   color: "text-purple-600"},
          { label: "No website",    val: stats.noWebsite,   icon: AlertTriangle, color: "text-red-500"},
          ].map(({ label, val, icon: Icon, color }) => (
            <div key={label} className="card">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={14} className={color} />
                <span className="text-[11px] font-bold uppercase text-[var(--ink-faint)]">{label}</span>
              </div>
              <p className="font-display text-[1.6rem] text-[var(--ink)] leading-none">{val.toLocaleString()}</p>
              <div className="mt-2 h-1.5 bg-[var(--app-bg)] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-current transition-all" style={{ width: `${pct(val)}%`, color: color.replace("text-", "") === color ? "#10b981" : "currentColor" }} />
              </div>
              <p className="text-[11px] text-[var(--ink-faint)] mt-1">{pct(val)}% of {stats.total.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="card space-y-4">
        <p className="section-tag">Run scraper</p>

        {/* Mode */}
        <div>
          <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-2">What to scrape</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              ["all",    "Everything",  "Photos + logo + blurb"],
              ["photos", "Photos only", "Images from website"],
              ["logo",   "Logo only",   "Logo / favicon"],
              ["blurb",  "Blurb only",  "Meta description"],
            ] as const).map(([val, label, desc]) => (
              <button key={val} onClick={() => setMode(val)}
                className="flex flex-col items-start px-3 py-2.5 rounded-xl border-2 text-left transition-all"
                style={{
                  borderColor: mode === val ? "var(--navy)" : "var(--line)",
                  background:  mode === val ? "rgba(10,23,34,.04)" : "white",
                }}>
                <p className="font-bold text-[13px] text-[var(--ink)]">{label}</p>
                <p className="text-[11px] text-[var(--ink-faint)]">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Auto-run toggle */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <div onClick={() => setAutoRun(a => !a)}
            className={`w-10 h-6 rounded-full transition-colors ${autoRun ? "bg-[var(--navy)]" : "bg-[var(--line)]"}`}>
            <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${autoRun ? "translate-x-5" : "translate-x-1"}`} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[var(--ink)]">Auto-run</p>
            <p className="text-[11.5px] text-[var(--ink-faint)]">Keep running batches of 30 automatically until done</p>
          </div>
        </label>

        {/* Run button */}
        <div className="flex items-center gap-3">
          <button onClick={runBatch} disabled={running}
            className="btn-primary px-6 py-3 flex items-center gap-2 text-[13.5px]">
            {running
              ? <><RefreshCw size={14} className="animate-spin" /> Scraping...</>
              : <><Play size={14} /> Run batch of 30</>}
          </button>
          {runCount > 0 && (
            <span className="text-[12.5px] text-[var(--ink-faint)]">{runCount} batch{runCount !== 1 ? "es" : ""} run this session</span>
          )}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check size={15} className="text-green-600" />
              <p className="font-bold text-[14px] text-[var(--ink)]">Batch complete</p>
            </div>
            <button onClick={() => setShowLog(l => !l)} className="flex items-center gap-1 text-[12px] text-[var(--ink-faint)]">
              Details {showLog ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Processed", result.processed, "text-[var(--ink)]"],
              ["Updated",   result.updated,   "text-green-600"],
              ["Skipped",   result.skipped,   "text-[var(--ink-faint)]"],
              ["Remaining", result.remaining, result.remaining > 0 ? "text-amber-600" : "text-green-600"],
            ].map(([label, val, color]) => (
              <div key={label as string} className="bg-[var(--app-bg)] rounded-xl px-3 py-2">
                <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">{label}</p>
                <p className={`font-display text-[1.4rem] ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          {result.skipReasons && Object.keys(result.skipReasons).length > 0 && (
            <div className="bg-[var(--app-bg)] rounded-xl px-3 py-2.5 space-y-1">
              <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)]">Skip reasons</p>
              {Object.entries(result.skipReasons).map(([reason, count]) => (
                <div key={reason} className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[var(--ink-soft)]">{reason}</span>
                  <span className="font-bold text-[var(--ink)]">{count}</span>
                </div>
              ))}
            </div>
          )}
          {result.remaining > 0 && !autoRun && (
            <div className="flex items-center gap-2 text-[12.5px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              <AlertTriangle size={13} />
              {result.remaining.toLocaleString()} listings still need scraping. Keep clicking &quot;Run batch&quot; or enable auto-run.
            </div>
          )}

          {showLog && result.detail.length > 0 && (
            <div className="bg-[var(--app-bg)] rounded-xl p-3 max-h-48 overflow-y-auto">
              {result.detail.map((line, i) => (
                <p key={i} className="text-[11.5px] font-mono text-[var(--ink-soft)]">{line}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
        <p className="font-bold text-[13px] text-blue-900 mb-1">How this works</p>
        <div className="text-[12.5px] text-blue-700 space-y-1">
          <p><strong>Photos:</strong> Pulls og:image, Twitter card image, hero section images, and JSON-LD image data. Stores to Supabase Storage -- no Google API calls.</p>
          <p><strong>Logo:</strong> Looks for img[alt*=logo], apple-touch-icon, then favicon. Better than Google&apos;s photo_references for brand marks.</p>
          <p><strong>Blurb:</strong> Uses meta description or og:description. Shows on the directory listing card.</p>
          <p><strong>Rate:</strong> 30 listings per batch, 8 second timeout per site, skips non-200 responses.</p>
        </div>
      </div>
    </div>
  );
}
