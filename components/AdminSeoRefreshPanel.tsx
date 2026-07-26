"use client";

import { useState } from "react";
import { RefreshCw, MapPin } from "lucide-react";

interface RefreshResult {
  ok: boolean;
  pagesScanned: number;
  pagesUpdated: number;
  pagesNewlyIndexed: number;
  pagesNewlyDeindexed: number;
  sitemapPinged: boolean;
  error?: string;
}

export default function AdminSeoRefreshPanel() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/seo/refresh", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, pagesScanned: 0, pagesUpdated: 0, pagesNewlyIndexed: 0, pagesNewlyDeindexed: 0, sitemapPinged: false, error: "Could not reach the server" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6 mb-6">
      <h2 className="font-semibold text-[15px] text-[var(--ink)] mb-1 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-[var(--amber)]" /> Trade x suburb pages
      </h2>
      <p className="text-[12.5px] text-[var(--ink-soft)] mb-4">
        Recomputes trade_suburb_pages (used by /areas, /tradies-in-..., and the trade+suburb pages) from live
        directory data, including each listing&apos;s real state derived from postcode. Runs automatically every
        Monday -- this runs it right now instead of waiting.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-1.5 bg-[var(--amber)] text-[var(--navy)] font-bold text-[12.5px] px-3 py-2 rounded-lg hover:brightness-95 transition-colors disabled:opacity-50"
        >
          {running ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {running ? "Refreshing..." : "Run now"}
        </button>
        {result && (
          <span className={`text-[12.5px] ${result.ok ? "text-[var(--ink-soft)]" : "text-red-600 font-semibold"}`}>
            {result.ok
              ? `Scanned ${result.pagesScanned}, updated ${result.pagesUpdated} (${result.pagesNewlyIndexed} newly indexed, ${result.pagesNewlyDeindexed} deindexed). Sitemap ${result.sitemapPinged ? "pinged" : "not pinged"}.`
              : result.error ?? "Refresh failed"}
          </span>
        )}
      </div>
    </div>
  );
}
