"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Globe, Image as ImageIcon, FileText, Briefcase, Play,
  RefreshCw, Check, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, ListChecks,
} from "lucide-react";
import { buildDirectorySlug } from "@/lib/seo/meta";

interface Stats {
  total: number;
  withWebsite: number;
  withPhotos: number;
  withLogo: number;
  withBlurb: number;
  withServices: number;
  noWebsite: number;
}

interface RecentListing {
  id: string;
  business_name: string;
  suburb: string | null;
  trades: string[] | null;
  website_url: string | null;
  services_offered: string[] | null;
  services_extraction_method: "structural" | "keyword" | null;
  blurb: string | null;
  logo_url: string | null;
  photo_references: string[]; // pre-filtered server-side to real http entries only
  years_experience: number | null;
  licenses: { type: string; number: string }[] | null;
  scraped_contact_phone: string | null;
  website_scraped_at: string | null;
}

type CompletenessFilter = "all" | "missing_photos" | "missing_services" | "fully_enriched";

interface RunResult {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  remaining: number;
  detail: string[];
  skipReasons?: Record<string, number>;
  photoRequestsMade?: number;
  estimatedCostUsd?: number;
}

export default function AdminWebsiteScraper() {
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [running,   setRunning]   = useState(false);
  const [result,    setResult]    = useState<RunResult | null>(null);
  const [mode,      setMode]      = useState<"all" | "photos" | "logo" | "blurb" | "google_photos">("all");
  const [showLog,   setShowLog]   = useState(false);
  const [autoRun,   setAutoRun]   = useState(false);
  const [runCount,  setRunCount]  = useState(0);
  const [recent,    setRecent]    = useState<RecentListing[] | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);
  const [methodFilter, setMethodFilter] = useState<"all" | "structural" | "keyword">("all");
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilter>("all");

  async function loadStats() {
    const res = await fetch("/api/admin/scrape-websites");
    if (res.ok) setStats(await res.json());
  }

  async function loadRecent() {
    setRecentLoading(true);
    const res = await fetch("/api/admin/scrape-websites?recent=1");
    if (res.ok) {
      const data = await res.json();
      setStats(data);
      setRecent(data.recent ?? []);
    }
    setRecentLoading(false);
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
    if (recent !== null) loadRecent(); // keep the review table in sync if it's open

    // Auto-run if enabled and there's more to do
    if (autoRun && data.remaining > 0) {
      setTimeout(runBatch, 2000);
    }
  }

  const pct = (n: number) => stats ? Math.round((n / stats.total) * 100) : 0;

  function completeness(r: RecentListing) {
    return {
      logo: !!r.logo_url,
      photos: r.photo_references.length > 0,
      blurb: !!r.blurb,
      services: !!(r.services_offered && r.services_offered.length > 0),
      phone: !!r.scraped_contact_phone,
      years: r.years_experience != null,
      licenses: !!(r.licenses && r.licenses.length > 0),
    };
  }

  function passesCompletenessFilter(r: RecentListing, filter: CompletenessFilter) {
    const c = completeness(r);
    if (filter === "missing_photos") return !c.photos;
    if (filter === "missing_services") return !c.services;
    if (filter === "fully_enriched") return c.logo && c.photos && c.blurb && c.services;
    return true;
  }

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
            { label: "Have services", val: stats.withServices,icon: ListChecks, color: "text-teal-600"  },
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

          {/* Separate, costed mode - kept visually distinct from the free
              options above since it's the only one that spends real
              money. Resolves the raw Google Place photo tokens already
              sitting in photo_references (from the original import)
              into real stored images via the Places Photo API, instead
              of hoping a business's own website has usable photos -
              confirmed against real production data that for most of
              the ~2,000 listings still missing a renderable photo, it
              doesn't. */}
          <button
            onClick={() => setMode("google_photos")}
            className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all"
            style={{
              borderColor: mode === "google_photos" ? "#b45309" : "var(--line)",
              background:  mode === "google_photos" ? "rgba(217,119,6,.06)" : "white",
            }}
          >
            <span className="shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Paid
            </span>
            <span className="flex-1">
              <span className="block font-bold text-[13px] text-[var(--ink)]">Photos via Google Places</span>
              <span className="block text-[11px] text-[var(--ink-faint)]">
                Resolves existing Google photo tokens into real images - ~$7 per 1,000 photo requests, roughly 1-4 requests per listing
              </span>
            </span>
          </button>
        </div>

        {/* Auto-run toggle - hidden for the paid mode so spend always
            needs a manual click per batch, not an unattended loop. */}
        {mode !== "google_photos" && (
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
        )}

        {/* Run button */}
        <div className="flex items-center gap-3">
          <button onClick={runBatch} disabled={running}
            className="btn-primary px-6 py-3 flex items-center gap-2 text-[13.5px]"
            style={mode === "google_photos" ? { background: "#b45309" } : undefined}>
            {running
              ? <><RefreshCw size={14} className="animate-spin" /> {mode === "google_photos" ? "Resolving..." : "Scraping..."}</>
              : <><Play size={14} /> {mode === "google_photos" ? "Run batch of 30 (spends money)" : "Run batch of 30"}</>}
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

          {typeof result.estimatedCostUsd === "number" && (
            <div className="flex items-center gap-2 text-[12.5px] text-amber-800 bg-amber-50 rounded-xl px-3 py-2">
              <span className="font-bold">${result.estimatedCostUsd.toFixed(2)}</span>
              spent this batch ({result.photoRequestsMade} Places Photo request{result.photoRequestsMade !== 1 ? "s" : ""} at ~$7/1,000)
            </div>
          )}

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

      {/* Review results - per-listing view so quality can actually be
          judged, not just aggregate counts. Shows every enriched field,
          not just services, with real photo thumbnails (already
          filtered server-side to http entries, so what's shown here is
          exactly what would render on the live listing page). Two
          independent filters: completeness (what's missing) and, for
          services specifically, extraction method - "structural" means
          the site's own markup produced it (higher confidence),
          "keyword" means it was inferred from a curated per-trade
          phrase list matched against plain text (worth spot-checking). */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="section-tag">Review results</p>
            <p className="text-[12px] text-[var(--ink-faint)] mt-0.5">
              Most recently scraped listings, newest first
            </p>
          </div>
          <button
            onClick={loadRecent}
            disabled={recentLoading}
            className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--navy)] px-3 py-1.5 rounded-lg border border-[var(--line)] hover:bg-[var(--app-bg)] transition-colors"
          >
            {recentLoading
              ? <><RefreshCw size={12} className="animate-spin" /> Loading...</>
              : <>{recent === null ? "Load results" : "Refresh"}</>}
          </button>
        </div>

        {recent !== null && recent.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {([
                ["all", "All"],
                ["missing_photos", "Missing photos"],
                ["missing_services", "Missing services"],
                ["fully_enriched", "Fully enriched"],
              ] as [CompletenessFilter, string][]).map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => setCompletenessFilter(f)}
                  className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition-colors"
                  style={{
                    background: completenessFilter === f ? "var(--navy)" : "var(--app-bg)",
                    color: completenessFilter === f ? "white" : "var(--ink-faint)",
                  }}
                >
                  {label}
                  {f !== "all" && ` (${recent.filter(r => passesCompletenessFilter(r, f)).length})`}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[var(--ink-faint)] mr-1">Services from:</span>
              {(["all", "structural", "keyword"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setMethodFilter(f)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
                  style={{
                    background: methodFilter === f ? "var(--ink)" : "var(--app-bg)",
                    color: methodFilter === f ? "white" : "var(--ink-faint)",
                  }}
                >
                  {f === "all" ? "Any" : f === "structural" ? "Site's own list" : "Keyword match"}
                </button>
              ))}
            </div>
          </>
        )}

        {recent !== null && recent.length === 0 && !recentLoading && (
          <p className="text-[12.5px] text-[var(--ink-faint)] py-4 text-center">
            No scraped listings yet - run a batch above first.
          </p>
        )}

        {recent !== null && recent.length > 0 && (
          <div className="space-y-2 max-h-[640px] overflow-y-auto -mx-1 px-1">
            {recent
              .filter(r => passesCompletenessFilter(r, completenessFilter))
              .filter(r => methodFilter === "all" || r.services_extraction_method === methodFilter)
              .map((r) => {
                const slug = buildDirectorySlug({ id: r.id, business_name: r.business_name, suburb: r.suburb ?? "" });
                const c = completeness(r);
                const fields: { key: keyof typeof c; label: string }[] = [
                  { key: "logo", label: "Logo" },
                  { key: "photos", label: "Photos" },
                  { key: "blurb", label: "Blurb" },
                  { key: "services", label: "Services" },
                  { key: "phone", label: "Phone" },
                  { key: "years", label: "Years exp" },
                  { key: "licenses", label: "Licences" },
                ];
                return (
                  <div key={r.id} className="bg-[var(--app-bg)] rounded-xl px-3 py-2.5 space-y-2">
                    <div className="flex items-start gap-3">
                      {/* Logo + up to 2 real photo thumbnails, exactly what the live page would show */}
                      <div className="flex gap-1 shrink-0">
                        {r.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.logo_url} alt="" className="w-9 h-9 rounded-lg object-contain bg-white border border-[var(--line)]" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-white border border-dashed border-[var(--line)]" />
                        )}
                        {r.photo_references.slice(0, 2).map((p, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={p} alt="" className="w-9 h-9 rounded-lg object-cover bg-white border border-[var(--line)]" />
                        ))}
                        {r.photo_references.length === 0 && (
                          <div className="w-9 h-9 rounded-lg bg-white border border-dashed border-[var(--line)] flex items-center justify-center">
                            <ImageIcon size={13} className="text-[var(--ink-faint)]" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-[13px] text-[var(--ink)] truncate">{r.business_name}</p>
                          {r.services_extraction_method && (
                            <span
                              className="shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                              style={{
                                background: r.services_extraction_method === "structural" ? "rgba(16,185,129,.12)" : "rgba(217,119,6,.12)",
                                color: r.services_extraction_method === "structural" ? "#059669" : "#b45309",
                              }}
                            >
                              {r.services_extraction_method === "structural" ? "Site's own list" : "Keyword match"}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--ink-faint)] mb-1.5">
                          {r.suburb ? `${r.suburb} · ` : ""}{(r.trades ?? []).join(", ")}
                        </p>

                        {/* Completeness checklist - every field at a glance */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {fields.map(({ key, label }) => (
                            <span key={key} className="flex items-center gap-1 text-[11px]" style={{ color: c[key] ? "#059669" : "var(--ink-faint)" }}>
                              {c[key] ? <Check size={11} /> : <span className="w-[11px] text-center">–</span>}
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Link
                        href={`/directory/${slug}`}
                        target="_blank"
                        className="shrink-0 flex items-center gap-1 text-[11.5px] font-semibold text-[var(--navy)] px-2 py-1 rounded-lg hover:bg-white transition-colors"
                      >
                        View <ExternalLink size={11} />
                      </Link>
                    </div>

                    {r.services_offered && r.services_offered.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-[84px]">
                        {r.services_offered.map((s, i) => (
                          <span key={i} className="text-[11px] bg-white border border-[var(--line)] rounded-full px-2 py-0.5 text-[var(--ink-soft)]">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Yellow Pages Scraper */}
      <YellowPagesScraper />

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
        <p className="font-bold text-[13px] text-blue-900 mb-1">How this works</p>
        <div className="text-[12.5px] text-blue-700 space-y-1">
          <p><strong>Photos:</strong> Pulls og:image, Twitter card image, hero section images, and JSON-LD image data. Stores to Supabase Storage - no Google API calls.</p>
          <p><strong>Logo:</strong> Looks for img[alt*=logo], apple-touch-icon, then favicon. Better than Google&apos;s photo_references for brand marks.</p>
          <p><strong>Blurb:</strong> Uses meta description or og:description. Shows on the directory listing card.</p>
          <p><strong>Services:</strong> Parses the site&apos;s own services list when there is one; falls back to matching a curated per-trade phrase list against the page text otherwise. Check the review table above to see which one produced each result.</p>
          <p><strong>Rate:</strong> 30 listings per batch, 8 second timeout per site, skips non-200 responses.</p>
          <p><strong>Photos via Google Places (paid):</strong> Most listings still missing a photo have raw Google Place photo tokens sitting in the database from the original import - real references to real business photos Google already verified, they just were never resolved into actual images. This mode does that directly via the Places Photo API (~$7/1,000 requests, 1-4 requests per listing) instead of relying on the business's own website having something usable.</p>
        </div>
      </div>
    </div>
  );
}

function YellowPagesScraper() {
  const [trade,    setTrade]    = useState("electrician");
  const [suburb,   setSuburb]   = useState("Melbourne VIC");
  const [postcode, setPostcode] = useState("");
  const [pages,    setPages]    = useState(3);
  const [running,  setRunning]  = useState(false);
  const [result,   setResult]   = useState<{found:number;inserted:number;skipped:number;pagesScraped:number}|null>(null);

  const TRADES = [
    "electrician","plumber","carpenter","roofer","painter",
    "tiler","landscaper","builder","concreter","plasterer",
    "airconditioning","solar","locksmith","glazier","fencer",
  ];

  // Major AU suburbs/cities with postcodes for targeted scraping
  const LOCATIONS = [
    // NSW
    { label: "Sydney CBD, NSW",         suburb: "Sydney NSW",          postcode: "2000" },
    { label: "Parramatta, NSW",          suburb: "Parramatta NSW",      postcode: "2150" },
    { label: "Newcastle, NSW",           suburb: "Newcastle NSW",       postcode: "2300" },
    { label: "Wollongong, NSW",          suburb: "Wollongong NSW",      postcode: "2500" },
    { label: "Penrith, NSW",             suburb: "Penrith NSW",         postcode: "2750" },
    { label: "Blacktown, NSW",           suburb: "Blacktown NSW",       postcode: "2148" },
    // VIC
    { label: "Melbourne CBD, VIC",       suburb: "Melbourne VIC",       postcode: "3000" },
    { label: "Geelong, VIC",             suburb: "Geelong VIC",         postcode: "3220" },
    { label: "Ballarat, VIC",            suburb: "Ballarat VIC",        postcode: "3350" },
    { label: "Bendigo, VIC",             suburb: "Bendigo VIC",         postcode: "3550" },
    { label: "Dandenong, VIC",           suburb: "Dandenong VIC",       postcode: "3175" },
    // QLD
    { label: "Brisbane CBD, QLD",        suburb: "Brisbane QLD",        postcode: "4000" },
    { label: "Gold Coast, QLD",          suburb: "Gold Coast QLD",      postcode: "4217" },
    { label: "Sunshine Coast, QLD",      suburb: "Sunshine Coast QLD",  postcode: "4557" },
    { label: "Townsville, QLD",          suburb: "Townsville QLD",      postcode: "4810" },
    { label: "Cairns, QLD",              suburb: "Cairns QLD",          postcode: "4870" },
    { label: "Toowoomba, QLD",           suburb: "Toowoomba QLD",       postcode: "4350" },
    // WA
    { label: "Perth CBD, WA",            suburb: "Perth WA",            postcode: "6000" },
    { label: "Fremantle, WA",            suburb: "Fremantle WA",        postcode: "6160" },
    { label: "Mandurah, WA",             suburb: "Mandurah WA",         postcode: "6210" },
    // SA
    { label: "Adelaide CBD, SA",         suburb: "Adelaide SA",         postcode: "5000" },
    { label: "Mount Gambier, SA",        suburb: "Mount Gambier SA",    postcode: "5290" },
    // TAS
    { label: "Hobart, TAS",              suburb: "Hobart TAS",          postcode: "7000" },
    // NT
    { label: "Darwin, NT",               suburb: "Darwin NT",           postcode: "0800" },
    // ACT
    { label: "Canberra, ACT",            suburb: "Canberra ACT",        postcode: "2600" },
  ];

  function handleLocationChange(label: string) {
    const loc = LOCATIONS.find(l => l.label === label);
    if (loc) { setSuburb(loc.suburb); setPostcode(loc.postcode); }
  }

  async function run() {
    setRunning(true); setResult(null);
    const res = await fetch("/api/admin/scrape-yellowpages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade, suburb, postcode, pages }),
    });
    setResult(await res.json());
    setRunning(false);
  }

  const selectedLocation = LOCATIONS.find(l => l.suburb === suburb);

  return (
    <div className="card space-y-4">
      <div>
        <p className="section-tag">Yellow Pages scraper</p>
        <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">
          Scrape Australian trade businesses from Yellow Pages. Free, no API key, no per-call cost.
          Captures suburb, postcode, and state for SEO-targeted directory pages.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {/* Trade */}
        <div>
          <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-1.5">Trade</p>
          <select value={trade} onChange={e => setTrade(e.target.value)} className="app-field text-[13px]">
            {TRADES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-1.5">Location</p>
          <select
            value={selectedLocation?.label ?? ""}
            onChange={e => handleLocationChange(e.target.value)}
            className="app-field text-[13px] mb-1.5"
          >
            {LOCATIONS.map(l => <option key={l.label}>{l.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-1.5">
            <input value={suburb} onChange={e => setSuburb(e.target.value)}
              className="app-field text-[12px]" placeholder="Suburb" />
            <input value={postcode} onChange={e => setPostcode(e.target.value)}
              className="app-field text-[12px]" placeholder="Postcode" />
          </div>
        </div>

        {/* Pages */}
        <div>
          <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-1.5">Pages to scrape</p>
          <select value={pages} onChange={e => setPages(Number(e.target.value))} className="app-field text-[13px]">
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} page{n>1?"s":""} (~{n*20} results)</option>)}
          </select>
          <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">
            Tip: run all 5 pages per location to maximise coverage
          </p>
        </div>
      </div>

      <button onClick={run} disabled={running}
        className="btn-primary w-full justify-center text-[14px] py-3">
        {running ? "Scraping Yellow Pages..." : `Scrape ${trade}s in ${suburb}`}
      </button>

      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-3">
            {([
              ["Pages scraped", result.pagesScraped, "text-[var(--ink)]"],
              ["Found",         result.found,        "text-[var(--ink)]"],
              ["Inserted",      result.inserted,     "text-green-600"],
              ["Skipped",       result.skipped,      "text-[var(--ink-faint)]"],
            ] as [string, number, string][]).map(([label, val, color]) => (
              <div key={label} className="bg-[var(--app-bg)] rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase text-[var(--ink-faint)]">{label}</p>
                <p className={`font-display text-[1.5rem] ${color}`}>{val}</p>
              </div>
            ))}
          </div>
          {result.inserted > 0 && (
            <p className="text-[12px] text-green-600 font-semibold">
              ✓ Added {result.inserted} new {trade}s from {suburb} to the directory
            </p>
          )}
        </div>
      )}
    </div>
  );
}
