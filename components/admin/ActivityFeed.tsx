"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, User, HelpCircle, RefreshCw, MapPin, UserPlus, FileCheck2 } from "lucide-react";

interface ActivityEvent {
  type: "claim" | "signup";
  outcome: string | null;
  business: string | null;
  suburb: string | null;
  trade: string | null;
  ip: string | null;
  deviceKind: "bot" | "human" | "unknown";
  deviceLabel: string;
  at: string;
}

interface ActivityResponse {
  summary: { total: number; humans: number; bots: number; unknown: number };
  repeatedIps: { ip: string; count: number }[];
  events: ActivityEvent[];
  error?: string;
}

/**
 * components/admin/ActivityFeed.tsx
 * -----------------------------------
 * Renders GET /api/admin/activity as a glanceable feed rather than raw
 * JSON. Each row is one real database event (a signup or a claim
 * attempt), tagged bot/human/unknown by an icon and colour rather than a
 * word you have to read, since the entire point of this view is being
 * able to tell at a glance what a stretch of activity actually was.
 *
 * Deliberately not a live-updating log tail. That would need a websocket
 * or polling loop for a page that gets checked occasionally, not watched
 * continuously -- a manual refresh button is the honest match for how
 * this is actually used.
 */
export default function ActivityFeed() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/activity?limit=100");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const badge = (kind: ActivityEvent["deviceKind"]) => {
    if (kind === "bot")
      return { Icon: Bot, cls: "bg-[var(--line-subtle)] text-[var(--ink-faint)]" };
    if (kind === "human")
      return { Icon: User, cls: "bg-[#eaf6ee] text-[#2f7a4a]" };
    return { Icon: HelpCircle, cls: "bg-[#fff4e5] text-[#9a6a1f]" };
  };

  const outcomeColour = (outcome: string | null) => {
    if (outcome === "claimed") return "text-[#2f7a4a]";
    if (outcome === "created_new") return "text-[var(--amber-deep)]";
    if (outcome === "disputed") return "text-[#b3432f]";
    return "text-[var(--ink-faint)]";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {data && (
          <div className="flex gap-4 text-[12.5px] text-[var(--ink-soft)]">
            <span><strong className="text-[var(--ink)]">{data.summary.total}</strong> events</span>
            <span className="flex items-center gap-1"><User size={13} className="text-[#2f7a4a]" /> {data.summary.humans} human</span>
            <span className="flex items-center gap-1"><Bot size={13} className="text-[var(--ink-faint)]" /> {data.summary.bots} bot</span>
            {data.summary.unknown > 0 && (
              <span className="flex items-center gap-1"><HelpCircle size={13} className="text-[#9a6a1f]" /> {data.summary.unknown} unknown</span>
            )}
          </div>
        )}
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-[#fdecea] text-[#b3432f] text-[13px]">{error}</div>
      )}

      {data && data.repeatedIps.length > 0 && (
        <div className="mb-5 rounded-xl border border-[#fbd9cf] bg-[#fff7f5] p-3.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#b3432f] mb-2">
            IPs appearing more than once in this window
          </p>
          <div className="flex flex-wrap gap-2">
            {data.repeatedIps.map((r) => (
              <span key={r.ip} className="text-[12.5px] font-mono bg-white border border-[#fbd9cf] rounded-md px-2 py-1 text-[#8a3a2a]">
                {r.ip} <span className="text-[#b3432f] font-bold">×{r.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--line)] divide-y divide-[var(--line-subtle)] overflow-hidden">
        {loading && !data && (
          <div className="p-6 text-center text-[13px] text-[var(--ink-faint)]">Loading…</div>
        )}
        {data?.events.length === 0 && (
          <div className="p-6 text-center text-[13px] text-[var(--ink-faint)]">No activity in this window.</div>
        )}
        {data?.events.map((e, i) => {
          const { Icon, cls } = badge(e.deviceKind);
          const TypeIcon = e.type === "signup" ? UserPlus : FileCheck2;
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--line-subtle)]/40">
              <span className={`shrink-0 w-7 h-7 rounded-full grid place-items-center ${cls}`}>
                <Icon size={14} />
              </span>
              <TypeIcon size={14} className="text-[var(--ink-faint)] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13.5px] font-semibold text-[var(--ink)] truncate">
                    {e.business ?? (e.type === "signup" ? "New account" : "Claim attempt")}
                  </span>
                  {e.outcome && (
                    <span className={`text-[11px] font-bold uppercase tracking-wide ${outcomeColour(e.outcome)}`}>
                      {e.outcome.replace("_", " ")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-[11.5px] text-[var(--ink-faint)]">
                  {e.suburb && (
                    <span className="flex items-center gap-0.5"><MapPin size={10} /> {e.suburb}</span>
                  )}
                  {e.trade && <span>{e.trade}</span>}
                  <span>{e.deviceLabel}</span>
                  {e.ip && <span className="font-mono">{e.ip}</span>}
                </div>
              </div>
              <span className="text-[11.5px] text-[var(--ink-faint)] shrink-0 tabular-nums">
                {new Date(e.at).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
