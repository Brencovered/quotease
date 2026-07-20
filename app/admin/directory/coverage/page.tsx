"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, MapPin, ArrowUpDown, Zap } from "lucide-react";

const TRADE_COLUMNS = [
  { key: "electrician", label: "Elec" },
  { key: "plumber", label: "Plumb" },
  { key: "carpenter", label: "Carp" },
  { key: "roofer", label: "Roof" },
  { key: "painter", label: "Paint" },
  { key: "tiler", label: "Tile" },
  { key: "landscaper", label: "Land" },
  { key: "concreter", label: "Concr" },
  { key: "fencer", label: "Fence" },
  { key: "aircon", label: "Aircon" },
];

// Below this count for a given postcode+trade combo, flag it as thin.
const LOW_THRESHOLD = 3;
const SCRAPE_RADIUS_KM = 15;

type PostcodeRow = {
  postcode: string;
  state: string;
  suburb: string;
  total: number;
  byTrade: Record<string, number>;
};

type SortKey = "total" | "postcode" | "state" | string;
type CellStatus = "scraping" | "done" | "error";

function cellKey(postcode: string, trade: string) {
  return `${postcode}|${trade}`;
}

export default function CoveragePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postcodes, setPostcodes] = useState<PostcodeRow[]>([]);
  const [stateCount, setStateCount] = useState(0);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortAsc, setSortAsc] = useState(false);
  const [cellStatus, setCellStatus] = useState<Record<string, CellStatus>>({});
  const [cellMessage, setCellMessage] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/admin/directory/coverage", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json();
          setError(d.error ?? "Failed to load coverage data");
          return;
        }
        const data = await r.json();
        setPostcodes(data.postcodes ?? []);
        setStateCount(data.stateCount ?? 0);
      })
      .catch(() => setError("Failed to load coverage data"))
      .finally(() => setLoading(false));
  }, []);

  const states = useMemo(
    () => Array.from(new Set(postcodes.map((p) => p.state))).sort(),
    [postcodes]
  );

  const rows = useMemo(() => {
    let filtered = stateFilter === "all" ? postcodes : postcodes.filter((p) => p.state === stateFilter);
    filtered = [...filtered].sort((a, z) => {
      let av: number | string;
      let zv: number | string;
      if (sortKey === "total") { av = a.total; zv = z.total; }
      else if (sortKey === "postcode") { av = a.postcode; zv = z.postcode; }
      else if (sortKey === "state") { av = a.state; zv = z.state; }
      else { av = a.byTrade[sortKey] ?? 0; zv = z.byTrade[sortKey] ?? 0; }
      if (typeof av === "string" || typeof zv === "string") {
        return sortAsc ? String(av).localeCompare(String(zv)) : String(zv).localeCompare(String(av));
      }
      return sortAsc ? av - zv : zv - av;
    });
    return filtered;
  }, [postcodes, stateFilter, sortKey, sortAsc]);

  // Thin spots: postcodes with a real total but near-zero for a specific
  // trade -- these are what "insights into areas with low trade numbers"
  // actually means. Sorted so the biggest, best-established postcodes with
  // a glaring gap surface first (most worth scraping).
  const thinSpots = useMemo(() => {
    const spots: { postcode: string; suburb: string; state: string; trade: string; count: number; total: number }[] = [];
    for (const row of postcodes) {
      if (row.total < 5) continue; // skip postcodes too small to judge yet
      for (const t of TRADE_COLUMNS) {
        const count = row.byTrade[t.key] ?? 0;
        if (count < LOW_THRESHOLD) {
          spots.push({ postcode: row.postcode, suburb: row.suburb, state: row.state, trade: t.key, count, total: row.total });
        }
      }
    }
    return spots.sort((a, z) => z.total - a.total).slice(0, 20);
  }, [postcodes]);

  // Click a cell -> run a real scrape for that postcode+trade combo, right
  // from the table. Updates the cell's count in place from the response
  // rather than a full page refetch.
  async function runScrape(postcode: string, trade: string) {
    const key = cellKey(postcode, trade);
    if (cellStatus[key] === "scraping") return; // already running, ignore re-clicks

    setCellStatus((prev) => ({ ...prev, [key]: "scraping" }));
    setCellMessage((prev) => { const next = { ...prev }; delete next[key]; return next; });

    try {
      const res = await fetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade, postcode, radiusKm: SCRAPE_RADIUS_KM }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCellStatus((prev) => ({ ...prev, [key]: "error" }));
        setCellMessage((prev) => ({ ...prev, [key]: data.error ?? "Scrape failed" }));
        return;
      }

      const added = (data.totalNew ?? 0) + (data.totalUpdated ?? 0);
      setPostcodes((prev) =>
        prev.map((row) => {
          if (row.postcode !== postcode) return row;
          return {
            ...row,
            total: row.total + (data.totalNew ?? 0),
            byTrade: { ...row.byTrade, [trade]: (row.byTrade[trade] ?? 0) + (data.totalNew ?? 0) },
          };
        })
      );
      setCellStatus((prev) => ({ ...prev, [key]: "done" }));
      setCellMessage((prev) => ({
        ...prev,
        [key]: added > 0 ? `+${data.totalNew ?? 0} new` : "No new results",
      }));
      // Clear the transient "done" highlight after a few seconds, but leave
      // the updated count in place.
      setTimeout(() => {
        setCellStatus((prev) => { const next = { ...prev }; delete next[key]; return next; });
      }, 4000);
    } catch {
      setCellStatus((prev) => ({ ...prev, [key]: "error" }));
      setCellMessage((prev) => ({ ...prev, [key]: "Could not reach the server" }));
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  }

  function cellColor(count: number): string {
    if (count === 0) return "bg-red-50 text-red-700";
    if (count < LOW_THRESHOLD) return "bg-amber-50 text-amber-700";
    if (count < 8) return "bg-emerald-50 text-emerald-700";
    return "bg-emerald-100 text-emerald-800 font-semibold";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[var(--ink-faint)]" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-[13.5px] rounded-xl px-4 py-3">
        <AlertTriangle size={16} /> {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-[var(--ink)]">Directory coverage</h1>
          <p className="text-[13px] text-[var(--ink-faint)]">
            {postcodes.length.toLocaleString()} postcodes across {stateCount} states with at least one listing.
            Only shows gaps within existing data -- postcodes with zero listings at all don&apos;t appear here.
            Click any cell to run a real scrape for that postcode + trade ({SCRAPE_RADIUS_KM}km radius) right here.
          </p>
        </div>
        <Link href="/admin/scraper" className="text-[13px] font-semibold text-[var(--amber)] hover:underline">
          Go to scraper →
        </Link>
      </div>

      {/* Thin spots insight panel */}
      {thinSpots.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-[12px] font-bold text-amber-800 uppercase tracking-wide mb-3">
            Worth scraping next -- established postcodes with a thin trade
          </p>
          <div className="flex flex-wrap gap-2">
            {thinSpots.map((s) => {
              const key = cellKey(s.postcode, s.trade);
              const status = cellStatus[key];
              const message = cellMessage[key];
              return (
                <button
                  key={key}
                  onClick={() => runScrape(s.postcode, s.trade)}
                  disabled={status === "scraping"}
                  title={`Click to scrape ${TRADE_COLUMNS.find((t) => t.key === s.trade)?.label} in ${s.postcode}`}
                  className="relative inline-flex items-center gap-1.5 text-[12.5px] bg-white border border-amber-200 rounded-full px-3 py-1 hover:border-amber-400 transition-colors"
                >
                  <MapPin size={11} className="text-amber-600" />
                  <span className="font-semibold">{s.suburb || s.postcode}</span>
                  <span className="text-[var(--ink-faint)]">{s.postcode} ({s.state})</span>
                  <span className="text-amber-700 font-semibold">
                    {TRADE_COLUMNS.find((t) => t.key === s.trade)?.label}: {s.count}
                  </span>
                  {status === "scraping" ? (
                    <Loader2 size={11} className="animate-spin text-amber-600" />
                  ) : (
                    <Zap size={11} className="text-amber-500" />
                  )}
                  {message && status !== "scraping" && (
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 whitespace-nowrap text-[10.5px] font-semibold bg-[var(--navy)] text-white rounded px-2 py-0.5 shadow-lg">
                      {message}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* State filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setStateFilter("all")}
          className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-lg border ${stateFilter === "all" ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "bg-white border-[var(--line)] text-[var(--ink-soft)]"}`}
        >
          All states
        </button>
        {states.map((s) => (
          <button
            key={s}
            onClick={() => setStateFilter(s)}
            className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-lg border ${stateFilter === s ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "bg-white border-[var(--line)] text-[var(--ink-soft)]"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Coverage matrix */}
      <div className="bg-white rounded-xl border border-[var(--line)] overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--app-bg)]">
              <Th label="Postcode" onClick={() => toggleSort("postcode")} active={sortKey === "postcode"} asc={sortAsc} />
              <Th label="Suburb" onClick={() => toggleSort("postcode")} active={false} asc={sortAsc} />
              <Th label="State" onClick={() => toggleSort("state")} active={sortKey === "state"} asc={sortAsc} />
              <Th label="Total" onClick={() => toggleSort("total")} active={sortKey === "total"} asc={sortAsc} />
              {TRADE_COLUMNS.map((t) => (
                <Th key={t.key} label={t.label} onClick={() => toggleSort(t.key)} active={sortKey === t.key} asc={sortAsc} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.postcode} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--app-bg)]">
                <td className="px-3 py-2 font-semibold text-[var(--ink)]">{row.postcode}</td>
                <td className="px-3 py-2 text-[var(--ink-soft)]">{row.suburb}</td>
                <td className="px-3 py-2 text-[var(--ink-faint)]">{row.state}</td>
                <td className="px-3 py-2 font-semibold text-[var(--ink)]">{row.total}</td>
                {TRADE_COLUMNS.map((t) => {
                  const key = cellKey(row.postcode, t.key);
                  const status = cellStatus[key];
                  const message = cellMessage[key];
                  return (
                    <td
                      key={t.key}
                      onClick={() => runScrape(row.postcode, t.key)}
                      title={`Click to scrape ${t.label} in ${row.postcode} (${SCRAPE_RADIUS_KM}km radius)`}
                      className={`relative px-3 py-2 text-center cursor-pointer transition-colors group ${
                        status === "error" ? "bg-red-100 text-red-700"
                        : status === "done" ? "bg-emerald-200 text-emerald-900"
                        : cellColor(row.byTrade[t.key] ?? 0)
                      } hover:ring-2 hover:ring-inset hover:ring-[var(--amber)]`}
                    >
                      {status === "scraping" ? (
                        <Loader2 size={12} className="animate-spin mx-auto" />
                      ) : (
                        <>
                          {row.byTrade[t.key] ?? 0}
                          <Zap size={9} className="hidden group-hover:inline-block ml-1 text-[var(--amber)] align-middle" />
                        </>
                      )}
                      {message && status !== "scraping" && (
                        <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 whitespace-nowrap text-[10.5px] font-semibold bg-[var(--navy)] text-white rounded px-2 py-0.5 shadow-lg">
                          {message}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ label, onClick, active, asc }: { label: string; onClick: () => void; active: boolean; asc: boolean }) {
  return (
    <th
      onClick={onClick}
      className="px-3 py-2 text-left font-bold text-[var(--ink-faint)] uppercase tracking-wide text-[10.5px] cursor-pointer select-none"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown size={10} className={active ? "text-[var(--ink)]" : "text-[var(--ink-faint)]/40"} />
        {active && <span className="sr-only">{asc ? "ascending" : "descending"}</span>}
      </span>
    </th>
  );
}
