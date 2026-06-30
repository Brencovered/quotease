"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search,
  Loader2,
  Check,
  AlertCircle,
  Database,
  Mail,
  Phone,
  Star,
  Image,
  Globe,
  Wrench,
  Play,
  MapPin,
  Hash,
  Clock,
  Zap,
  ChevronDown,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ScrapeRecord {
  id: string;
  date: string;
  trade: string;
  suburb: string;
  placesFound: number;
  enriched: number;
  newCount: number;
  updatedCount: number;
  withEmail: number;
  withPhone: number;
}

interface ScrapeApiResponse {
  success: boolean;
  placesFound: number;
  enriched: number;
  new: number;
  updated: number;
  withEmail: number;
  withPhone: number;
  withRating: number;
  results: unknown[];
  error?: string;
}

interface StatsApiResponse {
  total: number;
  withEmail: number;
  withPhone: number;
  withRating: number;
  withPhotos: number;
  withLogo: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TRADES = [
  "electrician",
  "plumber",
  "carpenter",
  "roofer",
  "painter",
  "tiler",
  "landscaper",
  "concreter",
  "fencer",
  "plasterer",
  "handyman",
  "air conditioning",
];

const TRADE_COLORS: Record<string, string> = {
  electrician: "#f59e0b",
  plumber: "#3b82f6",
  carpenter: "#92400e",
  roofer: "#ef4444",
  painter: "#a855f7",
  tiler: "#06b6d4",
  landscaper: "#16a34a",
  concreter: "#71717a",
  fencer: "#854d0e",
  plasterer: "#ec4899",
  handyman: "#0a1722",
  "air conditioning": "#06b6d4",
};

const RESULT_OPTIONS = [10, 20, 50];

const STAT_CONFIGS: { label: string; key: keyof StatsApiResponse; icon: React.ElementType }[] = [
  { label: "Total tradies", key: "total", icon: Database },
  { label: "With email", key: "withEmail", icon: Mail },
  { label: "With phone", key: "withPhone", icon: Phone },
  { label: "With ratings", key: "withRating", icon: Star },
  { label: "With photos", key: "withPhotos", icon: Image },
  { label: "With logo", key: "withLogo", icon: Globe },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminScraperPage() {
  const [trade, setTrade] = useState("electrician");
  const [suburb, setSuburb] = useState("");
  const [numResults, setNumResults] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<ScrapeRecord | null>(null);
  const [recentScrapes, setRecentScrapes] = useState<ScrapeRecord[]>([]);
  const [stats, setStats] = useState<StatsApiResponse>({
    total: 0,
    withEmail: 0,
    withPhone: 0,
    withRating: 0,
    withPhotos: 0,
    withLogo: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  /* ---- fetch stats on mount ---- */
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) throw new Error("Failed to load stats");
        const data: StatsApiResponse = await res.json();
        setStats(data);
      } catch {
        // fallback mock values for demo
        setStats({
          total: 196,
          withEmail: 134,
          withPhone: 172,
          withRating: 98,
          withPhotos: 45,
          withLogo: 12,
        });
      } finally {
        setStatsLoading(false);
      }
    }
    fetchStats();
  }, []);

  /* ---- auto-scroll progress log ---- */
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [progress]);

  /* ---- add progress entry ---- */
  const log = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setProgress((prev) => [...prev, `[${timestamp}] ${msg}`]);
  }, []);

  /* ---- run scrape ---- */
  const handleScrape = async () => {
    if (!trade || !suburb.trim()) {
      setError("Please select a trade and enter a suburb.");
      return;
    }

    setError(null);
    setLoading(true);
    setProgress([]);
    setLastResult(null);

    log(`Starting scrape for ${trade} in ${suburb.trim()}...`);

    try {
      const res = await fetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade, suburb: suburb.trim(), limit: numResults }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Server error (${res.status})`);
      }

      const data: ScrapeApiResponse = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Scrape failed");
      }

      log(`Found ${data.placesFound} places in ${suburb.trim()}`);
      log(`Enriched ${data.enriched} with additional data`);
      log(`Saved ${data.new} new tradies, ${data.updated} updated`);
      log(`Details: ${data.withEmail} with email, ${data.withPhone} with phone`);
      log("Scrape complete!");

      const record: ScrapeRecord = {
        id: generateId(),
        date: new Date().toISOString(),
        trade,
        suburb: suburb.trim(),
        placesFound: data.placesFound,
        enriched: data.enriched,
        newCount: data.new,
        updatedCount: data.updated,
        withEmail: data.withEmail,
        withPhone: data.withPhone,
      };

      setLastResult(record);
      setRecentScrapes((prev) => [record, ...prev]);

      // refresh stats
      try {
        const statsRes = await fetch("/api/admin/stats");
        if (statsRes.ok) {
          const statsData: StatsApiResponse = await statsRes.json();
          setStats(statsData);
        }
      } catch {
        // silently ignore stats refresh failure
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      log(`Error: ${message}`);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* ---- Header ---- */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-[var(--ink)]">Tradie Scraper</h1>
        <p className="text-[13px] text-[var(--ink-soft)]">
          Find and import tradies from Google Places. Scrape by trade and suburb.
        </p>
      </div>

      {/* ---- Two-column layout ---- */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ---- Left Column (65%) ---- */}
        <div className="w-full lg:w-[65%] flex flex-col gap-6">
          {/* ---- Scrape Form Card ---- */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6">
            <h2 className="font-semibold text-[15px] text-[var(--ink)] mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--amber)]" />
              New Scrape
            </h2>

            <div className="flex flex-col gap-4">
              {/* Trade select */}
              <div>
                <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                  Trade
                </label>
                <div className="relative">
                  <Wrench
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-faint)] pointer-events-none"
                  />
                  <select
                    value={trade}
                    onChange={(e) => setTrade(e.target.value)}
                    disabled={loading}
                    className="app-field pl-9 py-2.5 text-[14px] appearance-none capitalize"
                  >
                    {TRADES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-faint)] pointer-events-none" />
                </div>
              </div>

              {/* Suburb input */}
              <div>
                <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                  Suburb
                </label>
                <div className="relative">
                  <MapPin
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-faint)] pointer-events-none"
                  />
                  <input
                    type="text"
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                    placeholder="e.g. Seaford VIC"
                    disabled={loading}
                    className="app-field pl-9 py-2.5 text-[14px]"
                  />
                </div>
              </div>

              {/* Number of results */}
              <div>
                <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                  Number of results
                </label>
                <div className="relative">
                  <Hash
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-faint)] pointer-events-none"
                  />
                  <select
                    value={numResults}
                    onChange={(e) => setNumResults(Number(e.target.value))}
                    disabled={loading}
                    className="app-field pl-9 py-2.5 text-[14px] appearance-none"
                  >
                    {RESULT_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n} results
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-faint)] pointer-events-none" />
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-[var(--red-bg)] border border-red-200 px-3.5 py-2.5 text-[13px] text-[var(--red)]">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Start button */}
              <button
                onClick={handleScrape}
                disabled={loading}
                className="btn-primary mt-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Scrape
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ---- Last Result Summary ---- */}
          {lastResult && !loading && (
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[var(--green)]" />
                </div>
                <h3 className="font-semibold text-[15px] text-[var(--ink)]">
                  Scrape Complete
                </h3>
                <span className="text-[12px] text-[var(--ink-faint)] ml-auto">
                  {fmtDate(lastResult.date)} at {fmtTime(lastResult.date)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatPill
                  label="Found"
                  value={lastResult.placesFound}
                  icon={Search}
                />
                <StatPill
                  label="Enriched"
                  value={lastResult.enriched}
                  icon={Zap}
                />
                <StatPill
                  label="New"
                  value={lastResult.newCount}
                  icon={Check}
                />
                <StatPill
                  label="Updated"
                  value={lastResult.updatedCount}
                  icon={Clock}
                />
                <StatPill
                  label="With Email"
                  value={lastResult.withEmail}
                  icon={Mail}
                />
                <StatPill
                  label="With Phone"
                  value={lastResult.withPhone}
                  icon={Phone}
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: TRADE_COLORS[lastResult.trade] || "#0a1722",
                  }}
                />
                <span className="text-[12.5px] font-semibold capitalize text-[var(--ink-soft)]">
                  {lastResult.trade}
                </span>
                <span className="text-[12.5px] text-[var(--ink-faint)]">
                  · {lastResult.suburb}
                </span>
              </div>
            </div>
          )}

          {/* ---- Recent Scrapes Table ---- */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--line-subtle)] flex items-center justify-between">
              <h2 className="font-semibold text-[15px] text-[var(--ink)]">
                Recent Scrapes
              </h2>
              <span className="text-[12px] text-[var(--ink-faint)] tabular">
                {recentScrapes.length} total
              </span>
            </div>

            {recentScrapes.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Search className="w-8 h-8 text-[var(--ink-faint)] mx-auto mb-2 opacity-40" />
                <p className="text-[13.5px] text-[var(--ink-faint)]">
                  No scrapes yet. Run one to see results here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--line-subtle)] text-[var(--ink-faint)] text-[11.5px] font-semibold uppercase tracking-wide">
                      <th className="text-left px-5 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">Trade</th>
                      <th className="text-left px-4 py-2.5">Suburb</th>
                      <th className="text-right px-4 py-2.5 tabular">Found</th>
                      <th className="text-right px-4 py-2.5 tabular">New</th>
                      <th className="text-right px-4 py-2.5 tabular">Updated</th>
                      <th className="text-right px-5 py-2.5 tabular">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line-subtle)]">
                    {recentScrapes.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-[var(--app-bg)] transition-colors"
                      >
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="text-[var(--ink-soft)] tabular">
                            {fmtDate(s.date)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor:
                                  TRADE_COLORS[s.trade] || "#0a1722",
                              }}
                            />
                            <span className="font-medium capitalize text-[var(--ink)]">
                              {s.trade}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--ink-soft)]">
                          {s.suburb}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular text-[var(--ink)]">
                          {s.placesFound}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular text-[var(--green)]">
                          {s.newCount}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular text-[var(--blue)]">
                          {s.updatedCount}
                        </td>
                        <td className="px-5 py-3 text-right tabular text-[var(--ink-soft)]">
                          {s.withEmail}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ---- Right Column (35%) ---- */}
        <div className="w-full lg:w-[35%] flex flex-col gap-6">
          {/* ---- Directory Stats Card ---- */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6">
            <h2 className="font-semibold text-[15px] text-[var(--ink)] mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--amber)]" />
              Directory Stats
            </h2>

            {statsLoading ? (
              <div className="flex flex-col gap-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded-lg shimmer"
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-0">
                {STAT_CONFIGS.map(({ label, key, icon: Icon }) => {
                  const val = stats[key];
                  const isTotal = key === "total";
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between py-3 ${
                        key !== "withLogo" ? "border-b border-[var(--line-subtle)]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 ${
                            isTotal
                              ? "text-[var(--amber)]"
                              : "text-[var(--ink-faint)]"
                          }`}
                        />
                        <span
                          className={`text-[13.5px] ${
                            isTotal
                              ? "font-semibold text-[var(--ink)]"
                              : "text-[var(--ink-soft)]"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                      <span
                        className={`tabular font-semibold ${
                          isTotal
                            ? "text-[18px] text-[var(--navy)]"
                            : "text-[14px] text-[var(--ink)]"
                        }`}
                      >
                        {val}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ---- Progress Log ---- */}
          {progress.length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--line-subtle)] flex items-center justify-between">
                <h2 className="font-semibold text-[14px] text-[var(--ink)] flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[var(--amber)]" />
                  Progress Log
                </h2>
                {loading && (
                  <Loader2 className="w-3.5 h-3.5 text-[var(--amber)] animate-spin" />
                )}
              </div>
              <div className="bg-[var(--navy)] p-4 max-h-72 overflow-y-auto text-[12.5px] leading-relaxed">
                {progress.map((entry, i) => {
                  const isError = entry.includes("Error:");
                  const isComplete = entry.includes("complete");
                  return (
                    <div
                      key={i}
                      className={`font-mono ${
                        isError
                          ? "text-red-400"
                          : isComplete
                          ? "text-green-400"
                          : "text-[var(--steel-1)]"
                      }`}
                    >
                      {entry}
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatPill({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2.5 bg-[var(--app-bg)] rounded-xl px-3.5 py-3">
      <Icon className="w-4 h-4 text-[var(--ink-faint)] flex-shrink-0" />
      <div>
        <p className="text-[11px] text-[var(--ink-faint)] font-medium">{label}</p>
        <p className="text-[18px] font-bold text-[var(--ink)] tabular leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
}
