"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  CheckCircle2,
  Circle,
  Target,
  Eye,
  Ban,
  TrendingUp,
  StickyNote,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

type SeoKeyword = {
  id: string;
  keyword: string;
  intent: string | null;
  volume: number | null;
  keyword_difficulty: number | null;
  cpc_usd: number | null;
  serp_features: string | null;
  status: "new" | "targeting" | "tracking" | "ignore" | "ranking";
  notes: string | null;
  created_at: string;
  current_position: number | null;
  clicks_28d: number | null;
  impressions_28d: number | null;
  last_synced_at: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Target; color: string; bg: string }> = {
  new:       { label: "New",       icon: Circle,        color: "text-[var(--ink-faint)]",  bg: "bg-[var(--surface)]" },
  targeting: { label: "Targeting", icon: Target,        color: "text-[var(--amber-deep)]",  bg: "bg-[var(--amber-light)]" },
  tracking:  { label: "Tracking",  icon: Eye,           color: "text-blue-600",             bg: "bg-blue-50" },
  ignore:    { label: "Ignore",    icon: Ban,           color: "text-[var(--ink-faint)]",  bg: "bg-gray-50" },
  ranking:   { label: "Ranking",   icon: TrendingUp,    color: "text-green-600",            bg: "bg-green-50" },
};

export default function SeoKeywordsPanel() {
  const [keywords, setKeywords] = useState<SeoKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [intentFilter, setIntentFilter] = useState("");
  const [sortBy, setSortBy] = useState("volume");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [total, setTotal] = useState(0);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchKeywords = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (intentFilter) params.set("intent", intentFilter);
    if (search) params.set("search", search);
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);

    try {
      const res = await fetch(`/api/seo/keywords?${params}`);
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter, intentFilter, search, sortBy, sortDir]);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  async function updateStatus(id: string, newStatus: string) {
    setUpdating(id);
    try {
      const res = await fetch("/api/seo/keywords", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        setKeywords((prev) =>
          prev.map((k) => (k.id === id ? { ...k, status: newStatus as SeoKeyword["status"] } : k))
        );
      }
    } catch {
      // silently fail
    } finally {
      setUpdating(null);
    }
  }

  async function saveNote(id: string) {
    setUpdating(id);
    try {
      const res = await fetch("/api/seo/keywords", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notes: noteValue }),
      });
      if (res.ok) {
        setKeywords((prev) =>
          prev.map((k) => (k.id === id ? { ...k, notes: noteValue } : k))
        );
        setEditingNote(null);
        setNoteValue("");
      }
    } catch {
      // silently fail
    } finally {
      setUpdating(null);
    }
  }

  async function syncRankings() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/seo/sync-rankings", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncMsg({ text: data.error || "Sync failed", ok: false });
        return;
      }
      setSyncMsg({
        text: `Matched ${data.matched} keyword${data.matched === 1 ? "" : "s"} with real search data, updated ${data.updated}.`,
        ok: true,
      });
      fetchKeywords();
    } catch (err) {
      setSyncMsg({ text: err instanceof Error ? err.message : "Network error", ok: false });
    } finally {
      setSyncing(false);
    }
  }

  function toggleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown size={12} className="text-[var(--ink-faint)]" />;
    return sortDir === "asc" ? (
      <ArrowUp size={12} className="text-[var(--amber-deep)]" />
    ) : (
      <ArrowDown size={12} className="text-[var(--amber-deep)]" />
    );
  };

  // Unique intents from data
  const intents = Array.from(new Set(keywords.map((k) => k.intent).filter(Boolean))) as string[];

  // Status breakdown
  const statusCounts = keywords.reduce<Record<string, number>>((acc, k) => {
    acc[k.status] = (acc[k.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page-wrap-narrow">
      <div className="flex items-center gap-3 mb-3 justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--navy)] flex items-center justify-center">
            <Search size={18} className="text-[var(--amber)]" />
          </div>
          <div>
            <h1 className="font-display text-[1.5rem] text-[var(--ink)]">SEO Keywords</h1>
            <p className="text-[13px] text-[var(--ink-faint)]">{total} keywords loaded</p>
          </div>
        </div>
        <button
          onClick={syncRankings}
          disabled={syncing}
          className="btn-secondary text-[12.5px] py-2 px-3.5 flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing rankings..." : "Sync rankings from Search Console"}
        </button>
      </div>

      {syncMsg && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold mb-3 ${syncMsg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {syncMsg.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {syncMsg.text}
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5 mt-2">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = statusCounts[key] ?? 0;
          const isActive = statusFilter === key;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(isActive ? "" : key)}
              className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border transition-all text-center ${
                isActive
                  ? "border-[var(--amber)] bg-[var(--amber-light)]"
                  : "border-[var(--line)] bg-white hover:border-[var(--amber)]"
              }`}
            >
              <cfg.icon size={15} className={cfg.color} />
              <span className="text-[11px] font-bold text-[var(--ink)]">{cfg.label}</span>
              <span className="text-[13px] font-bold text-[var(--navy)]">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
          <input
            type="text"
            placeholder="Search keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="app-field pl-9 text-[13px] w-full"
          />
        </div>
        {intents.length > 0 && (
          <select
            value={intentFilter}
            onChange={(e) => setIntentFilter(e.target.value)}
            className="app-field text-[13px] w-auto"
          >
            <option value="">All intents</option>
            {intents.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        )}
        {(statusFilter || intentFilter || search) && (
          <button
            onClick={() => { setStatusFilter(""); setIntentFilter(""); setSearch(""); }}
            className="btn-secondary text-[12.5px] py-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="text-[var(--amber-deep)] animate-spin" />
        </div>
      ) : keywords.length === 0 ? (
        <div className="card text-center py-16">
          <Search size={32} className="text-[var(--ink-faint)] mx-auto mb-3" />
          <p className="text-[15px] font-semibold text-[var(--ink)]">No keywords found</p>
          <p className="text-[13px] text-[var(--ink-faint)] mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[700px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="text-left py-2.5 px-3">
                  <button onClick={() => toggleSort("keyword")} className="flex items-center gap-1 font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                    Keyword <SortIcon col="keyword" />
                  </button>
                </th>
                <th className="text-left py-2.5 px-3 w-24">
                  <button onClick={() => toggleSort("status")} className="flex items-center gap-1 font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                    Status <SortIcon col="status" />
                  </button>
                </th>
                <th className="text-right py-2.5 px-3 w-20">
                  <button onClick={() => toggleSort("volume")} className="flex items-center gap-1 font-bold text-[var(--ink-soft)] hover:text-[var(ink)] ml-auto">
                    Vol <SortIcon col="volume" />
                  </button>
                </th>
                <th className="text-right py-2.5 px-3 w-16">
                  <button onClick={() => toggleSort("keyword_difficulty")} className="flex items-center gap-1 font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] ml-auto">
                    KD <SortIcon col="keyword_difficulty" />
                  </button>
                </th>
                <th className="text-right py-2.5 px-3 w-20">
                  <button onClick={() => toggleSort("cpc_usd")} className="flex items-center gap-1 font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] ml-auto">
                    CPC <SortIcon col="cpc_usd" />
                  </button>
                </th>
                <th className="text-right py-2.5 px-3 w-20">
                  <button onClick={() => toggleSort("current_position")} className="flex items-center gap-1 font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] ml-auto">
                    Position <SortIcon col="current_position" />
                  </button>
                </th>
                <th className="text-left py-2.5 px-3 w-32">SERP</th>
                <th className="text-left py-2.5 px-3 w-40">Notes</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((k) => {
                const cfg = STATUS_CONFIG[k.status];
                const StatusIcon = cfg.icon;
                return (
                  <tr key={k.id} className="border-b border-[var(--line-subtle)] hover:bg-[var(--app-bg)] transition-colors">
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-[var(--ink)]">{k.keyword}</p>
                      {k.intent && (
                        <span className="text-[11px] text-[var(--ink-faint)]">{k.intent}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="relative">
                        <select
                          value={k.status}
                          onChange={(e) => updateStatus(k.id, e.target.value)}
                          disabled={updating === k.id}
                          className={`text-[11px] font-bold px-2 py-1 rounded-lg border appearance-none pr-6 cursor-pointer ${cfg.color} ${cfg.bg} border-current`}
                        >
                          {Object.keys(STATUS_CONFIG).map((s) => (
                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                          ))}
                        </select>
                        {updating === k.id && (
                          <Loader2 size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--ink-faint)]" />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular">
                      <span className="font-semibold text-[var(--ink)]">{k.volume ?? "-"}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular">
                      <span className={`font-semibold ${
                        k.keyword_difficulty == null ? "text-[var(--ink-faint)]" :
                        k.keyword_difficulty <= 20 ? "text-green-600" :
                        k.keyword_difficulty <= 40 ? "text-[var(--amber-deep)]" :
                        "text-red-500"
                      }`}>
                        {k.keyword_difficulty ?? "-"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular">
                      <span className="text-[var(--ink-soft)]">
                        {k.cpc_usd ? `$${k.cpc_usd.toFixed(2)}` : "-"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular">
                      {k.current_position != null ? (
                        <span
                          className={`font-semibold ${
                            k.current_position <= 10 ? "text-green-600" :
                            k.current_position <= 30 ? "text-[var(--amber-deep)]" :
                            "text-[var(--ink-soft)]"
                          }`}
                          title={`${k.clicks_28d ?? 0} clicks, ${k.impressions_28d ?? 0} impressions (last 28 days)`}
                        >
                          {k.current_position.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[var(--ink-faint)]">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {k.serp_features && (
                        <span className="text-[10px] text-[var(--ink-faint)] line-clamp-2" title={k.serp_features}>
                          {k.serp_features}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {editingNote === k.id ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={noteValue}
                            onChange={(e) => setNoteValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveNote(k.id); if (e.key === "Escape") { setEditingNote(null); setNoteValue(""); } }}
                            className="app-field text-[11px] py-1 flex-1"
                            autoFocus
                          />
                          <button onClick={() => saveNote(k.id)} className="text-green-600 hover:text-green-700 p-0.5">
                            <CheckCircle2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingNote(k.id); setNoteValue(k.notes ?? ""); }}
                          className="flex items-center gap-1 text-[11px] text-[var(--ink-faint)] hover:text-[var(--ink-soft)] transition-colors"
                        >
                          <StickyNote size={11} />
                          {k.notes ? (
                            <span className="truncate max-w-[120px] text-[var(--ink-soft)]">{k.notes}</span>
                          ) : (
                            <span>Add note</span>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
