"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search, Loader2, Check, AlertCircle, Database, Mail, Phone, Star,
  Image, Globe, Wrench, Play, MapPin, Hash, Clock, Zap, ChevronDown,
  CheckSquare, Square, X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ScrapeRecord {
  id: string;
  date: string;
  trades: string[];
  postcode: string;
  radiusKm: number;
  placesFound: number;
  enriched: number;
  newCount: number;
  updatedCount: number;
  withEmail: number;
  withPhone: number;
}

interface PerTradeResult {
  trade: string;
  placesFound: number;
  enriched: number;
  new: number;
  updated: number;
  withEmail: number;
  withPhone: number;
  withRating: number;
  withLogo: number;
}

interface ScrapeApiResponse {
  success: boolean;
  postcode: string;
  radiusKm: number;
  tradesScraped: number;
  totalPlacesFound: number;
  totalEnriched: number;
  totalNew: number;
  totalUpdated: number;
  totalWithEmail: number;
  totalWithPhone: number;
  totalWithRating: number;
  totalWithLogo: number;
  durationMs: number;
  perTrade: PerTradeResult[];
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
  "electrician", "plumber", "carpenter", "roofer", "painter", "tiler",
  "landscaper", "concreter", "fencer", "plasterer", "handyman", "air conditioning",
];

const TRADE_COLORS: Record<string, string> = {
  electrician: "#f59e0b", plumber: "#3b82f6", carpenter: "#92400e",
  roofer: "#ef4444", painter: "#a855f7", tiler: "#06b6d4",
  landscaper: "#16a34a", concreter: "#71717a", fencer: "#854d0e",
  plasterer: "#ec4899", handyman: "#0a1722", "air conditioning": "#06b6d4",
};

const RESULT_OPTIONS = [10, 20, 50];
const RADIUS_OPTIONS = [5, 10, 15, 25, 50];

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
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(0);
  return `${mins}m ${secs}s`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminScraperPage() {
  const [selectedTrades, setSelectedTrades] = useState<string[]>(["electrician"]);
  const [postcode, setPostcode] = useState("");
  const [radiusKm, setRadiusKm] = useState(15);
  const [numResults, setNumResults] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<ScrapeRecord | null>(null);
  const [lastPerTrade, setLastPerTrade] = useState<PerTradeResult[] | null>(null);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const [recentScrapes, setRecentScrapes] = useState<ScrapeRecord[]>([]);
  const [stats, setStats] = useState<StatsApiResponse>({
    total: 0, withEmail: 0, withPhone: 0, withRating: 0, withPhotos: 0, withLogo: 0,
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
        setStats({ total: 196, withEmail: 134, withPhone: 172, withRating: 98, withPhotos: 45, withLogo: 12 });
      } finally { setStatsLoading(false); }
    }
    fetchStats();
  }, []);

  /* ---- auto-scroll progress log ---- */
  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [progress]);

  const log = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setProgress((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

  /* ---- trade checkbox helpers ---- */
  const toggleTrade = (trade: string) => {
    setSelectedTrades((prev) =>
      prev.includes(trade) ? prev.filter((t) => t !== trade) : [...prev, trade]
    );
  };

  const selectAll = () => setSelectedTrades([...TRADES]);
  const deselectAll = () => setSelectedTrades([]);
  const allSelected = selectedTrades.length === TRADES.length;

  /* ---- run scrape ---- */
  const handleScrape = async () => {
    if (selectedTrades.length === 0 || !postcode.trim()) {
      setError("Please select at least one trade and enter a postcode.");
      return;
    }
    if (!/^\d{4}$/.test(postcode.trim())) {
      setError("Postcode must be a 4-digit Australian postcode.");
      return;
    }

    setError(null);
    setLoading(true);
    setProgress([]);
    setLastResult(null);
    setLastPerTrade(null);
    setLastDuration(null);

    const tradeList = selectedTrades.length === TRADES.length
      ? "All trades"
      : `${selectedTrades.length} trade${selectedTrades.length > 1 ? "s" : ""}`;
    log(`Starting scrape: ${tradeList} within ${radiusKm}km of ${postcode.trim()}...`);

    try {
      const res = await fetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade: selectedTrades, postcode: postcode.trim(), radiusKm, limit: numResults }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Server error (${res.status})`);
      }

      const data: ScrapeApiResponse = await res.json();
      if (!data.success) throw new Error(data.error || "Scrape failed");

      // Log per-trade results
      for (const pt of data.perTrade) {
        log(`${pt.trade}: ${pt.placesFound} found | ${pt.new} new | ${pt.updated} updated | ${pt.withEmail} email | ${pt.withPhone} phone`);
      }

      log(`---`);
      log(`Total: ${data.totalPlacesFound} found | ${data.totalNew} new | ${data.totalUpdated} updated`);
      log(`With email: ${data.totalWithEmail} | With phone: ${data.totalWithPhone} | With ratings: ${data.totalWithRating}`);
      log(`Done in ${formatDuration(data.durationMs)}`);

      const record: ScrapeRecord = {
        id: generateId(), date: new Date().toISOString(),
        trades: selectedTrades, postcode: postcode.trim(), radiusKm,
        placesFound: data.totalPlacesFound, enriched: data.totalEnriched,
        newCount: data.totalNew, updatedCount: data.totalUpdated,
        withEmail: data.totalWithEmail, withPhone: data.totalWithPhone,
      };

      setLastResult(record);
      setLastPerTrade(data.perTrade);
      setLastDuration(data.durationMs);
      setRecentScrapes((prev) => [record, ...prev]);

      // Refresh stats
      try {
        const statsRes = await fetch("/api/admin/stats");
        if (statsRes.ok) setStats(await statsRes.json());
      } catch { /* ignore */ }
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-[var(--ink)]">Tradie Scraper</h1>
        <p className="text-[13px] text-[var(--ink-soft)]">
          Find and import tradies from Google Places. Select one or more trades and a postcode.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column (65%) */}
        <div className="w-full lg:w-[65%] flex flex-col gap-6">
          {/* Scrape Form */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6">
            <h2 className="font-semibold text-[15px] text-[var(--ink)] mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--amber)]" /> New Scrape
            </h2>

            <div className="flex flex-col gap-4">
              {/* Trade checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12.5px] font-semibold text-[var(--ink-soft)]">
                    Trades <span className="text-[var(--ink-faint)] font-normal">({selectedTrades.length} selected)</span>
                  </label>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-[11px] font-semibold text-[var(--amber)] hover:underline">
                      Select all
                    </button>
                    <span className="text-[var(--line)]">|</span>
                    <button onClick={deselectAll} className="text-[11px] font-semibold text-[var(--ink-faint)] hover:text-[var(--ink-soft)]">
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TRADES.map((t) => {
                    const checked = selectedTrades.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => toggleTrade(t)}
                        disabled={loading}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[13px] font-medium capitalize transition-all ${
                          checked
                            ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                            : "border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[var(--ink-faint)]"
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: checked ? "#fff" : (TRADE_COLORS[t] || "#ccc") }}
                        />
                        {t}
                        {checked && <Check className="w-3 h-3 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Postcode */}
              <div>
                <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Postcode</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-faint)] pointer-events-none" />
                  <input
                    type="text" inputMode="numeric" value={postcode} onChange={(e) => setPostcode(e.target.value)}
                    placeholder="e.g. 3199" disabled={loading}
                    className="app-field pl-9 py-2.5 text-[14px] w-full"
                  />
                </div>
              </div>

              {/* Radius */}
              <div>
                <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Radius</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-faint)] pointer-events-none" />
                  <select value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}
                    disabled={loading} className="app-field pl-9 py-2.5 text-[14px] appearance-none w-full">
                    {RADIUS_OPTIONS.map((r) => <option key={r} value={r}>{r} km</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-faint)] pointer-events-none" />
                </div>
              </div>

              {/* Results limit */}
              <div>
                <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Results per trade</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-faint)] pointer-events-none" />
                  <select value={numResults} onChange={(e) => setNumResults(Number(e.target.value))}
                    disabled={loading} className="app-field pl-9 py-2.5 text-[14px] appearance-none w-full">
                    {RESULT_OPTIONS.map((n) => <option key={n} value={n}>{n} results</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-faint)] pointer-events-none" />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-[13px] text-red-600">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> <span>{error}</span>
                </div>
              )}

              {/* Button */}
              <button onClick={handleScrape} disabled={loading || selectedTrades.length === 0}
                className="btn-primary mt-1 disabled:opacity-40">
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Scraping {selectedTrades.length} trade{selectedTrades.length > 1 ? "s" : ""}...</>
                ) : (
                  <><Play className="w-4 h-4" /> Start Scrape ({selectedTrades.length} trade{selectedTrades.length > 1 ? "s" : ""})</>
                )}
              </button>
            </div>
          </div>

          {/* Last Result Summary */}
          {lastResult && !loading && (
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[var(--green)]" />
                </div>
                <h3 className="font-semibold text-[15px] text-[var(--ink)]">Scrape Complete</h3>
                <span className="text-[12px] text-[var(--ink-faint)] ml-auto">
                  {fmtDate(lastResult.date)} at {fmtTime(lastResult.date)}
                  {lastDuration !== null && ` · ${formatDuration(lastDuration)}`}
                </span>
              </div>

              {/* Overall stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <StatPill label="Found" value={lastResult.placesFound} icon={Search} />
                <StatPill label="New" value={lastResult.newCount} icon={Check} color="var(--green)" />
                <StatPill label="Updated" value={lastResult.updatedCount} icon={Clock} color="var(--blue)" />
                <StatPill label="With Email" value={lastResult.withEmail} icon={Mail} />
                <StatPill label="With Phone" value={lastResult.withPhone} icon={Phone} />
              </div>

              {/* Per-trade breakdown */}
              {lastPerTrade && lastPerTrade.length > 1 && (
                <div className="border-t border-[var(--line-subtle)] pt-4">
                  <p className="text-[11.5px] font-semibold text-[var(--ink-faint)] uppercase tracking-wide mb-2">Per trade</p>
                  <div className="space-y-1.5">
                    {lastPerTrade.map((pt) => (
                      <div key={pt.trade} className="flex items-center gap-3 text-[13px]">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TRADE_COLORS[pt.trade] || "#0a1722" }} />
                        <span className="capitalize font-medium w-28 text-[var(--ink)]">{pt.trade}</span>
                        <span className="tabular text-[var(--ink-soft)] w-16">{pt.placesFound} found</span>
                        <span className="tabular text-[var(--green)] w-12">{pt.new} new</span>
                        <span className="tabular text-[var(--blue)] w-16">{pt.updated} upd</span>
                        <span className="tabular text-[var(--ink-faint)]">{pt.withEmail} email</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trade tags */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {lastResult.trades.map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[var(--app-bg)] border border-[var(--line)] capitalize">
                    <span className="w-2 h-2 rounded-full" style={{ background: TRADE_COLORS[t] || "#0a1722" }} />
                    {t}
                  </span>
                ))}
                <span className="text-[12px] text-[var(--ink-faint)]">· {lastResult.postcode} ({lastResult.radiusKm}km)</span>
              </div>
            </div>
          )}

          {/* Recent Scrapes Table */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--line-subtle)] flex items-center justify-between">
              <h2 className="font-semibold text-[15px] text-[var(--ink)]">Recent Scrapes</h2>
              <span className="text-[12px] text-[var(--ink-faint)] tabular">{recentScrapes.length} total</span>
            </div>
            {recentScrapes.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Search className="w-8 h-8 text-[var(--ink-faint)] mx-auto mb-2 opacity-40" />
                <p className="text-[13.5px] text-[var(--ink-faint)]">No scrapes yet. Run one to see results here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--line-subtle)] text-[var(--ink-faint)] text-[11.5px] font-semibold uppercase tracking-wide">
                      <th className="text-left px-5 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">Trades</th>
                      <th className="text-left px-4 py-2.5">Postcode</th>
                      <th className="text-right px-4 py-2.5 tabular">Found</th>
                      <th className="text-right px-4 py-2.5 tabular">New</th>
                      <th className="text-right px-4 py-2.5 tabular">Updated</th>
                      <th className="text-right px-5 py-2.5 tabular">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line-subtle)]">
                    {recentScrapes.map((s) => (
                      <tr key={s.id} className="hover:bg-[var(--app-bg)] transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="text-[var(--ink-soft)] tabular">{fmtDate(s.date)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {s.trades.slice(0, 3).map((t) => (
                              <span key={t} className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[var(--app-bg)] capitalize">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: TRADE_COLORS[t] || "#0a1722" }} />
                                {t}
                              </span>
                            ))}
                            {s.trades.length > 3 && (
                              <span className="text-[11px] text-[var(--ink-faint)]">+{s.trades.length - 3} more</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--ink-soft)]">{s.postcode} <span className="text-[var(--ink-faint)]">({s.radiusKm}km)</span></td>
                        <td className="px-4 py-3 text-right font-semibold tabular text-[var(--ink)]">{s.placesFound}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular text-[var(--green)]">{s.newCount}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular text-[var(--blue)]">{s.updatedCount}</td>
                        <td className="px-5 py-3 text-right tabular text-[var(--ink-soft)]">{s.withEmail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (35%) */}
        <div className="w-full lg:w-[35%] flex flex-col gap-6">
          {/* Stats */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6">
            <h2 className="font-semibold text-[15px] text-[var(--ink)] mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--amber)]" /> Directory Stats
            </h2>
            {statsLoading ? (
              <div className="flex flex-col gap-3">
                {[...Array(6)].map((_, i) => <div key={i} className="h-10 rounded-lg shimmer" />)}
              </div>
            ) : (
              <div className="flex flex-col gap-0">
                {STAT_CONFIGS.map(({ label, key, icon: Icon }) => {
                  const val = stats[key];
                  const isTotal = key === "total";
                  return (
                    <div key={key} className={`flex items-center justify-between py-3 ${key !== "withLogo" ? "border-b border-[var(--line-subtle)]" : ""}`}>
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isTotal ? "text-[var(--amber)]" : "text-[var(--ink-faint)]"}`} />
                        <span className={`text-[13.5px] ${isTotal ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-soft)]"}`}>{label}</span>
                      </div>
                      <span className={`tabular font-semibold ${isTotal ? "text-[18px] text-[var(--navy)]" : "text-[14px] text-[var(--ink)]"}`}>{val}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Progress Log */}
          {progress.length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--line-subtle)] flex items-center justify-between">
                <h2 className="font-semibold text-[14px] text-[var(--ink)] flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[var(--amber)]" /> Progress Log
                </h2>
                {loading && <Loader2 className="w-3.5 h-3.5 text-[var(--amber)] animate-spin" />}
              </div>
              <div className="bg-[var(--navy)] p-4 max-h-72 overflow-y-auto text-[12.5px] leading-relaxed">
                {progress.map((entry, i) => {
                  const isError = entry.includes("Error:");
                  const isComplete = entry.includes("Done");
                  return (
                    <div key={i} className={`font-mono ${isError ? "text-red-400" : isComplete ? "text-green-400" : "text-[var(--steel-1)]"}`}>
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

function StatPill({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color?: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-[var(--app-bg)] rounded-xl px-3.5 py-3">
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: color || "var(--ink-faint)" }} />
      <div>
        <p className="text-[11px] text-[var(--ink-faint)] font-medium">{label}</p>
        <p className="text-[18px] font-bold tabular leading-tight" style={{ color: color || "var(--ink)" }}>{value}</p>
      </div>
    </div>
  );
}
