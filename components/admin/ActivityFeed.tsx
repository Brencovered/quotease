"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, User, RefreshCw, Pause, Play } from "lucide-react";

interface TrafficEvent {
  id: number;
  path: string;
  method: string;
  ip_address: string | null;
  user_agent: string | null;
  is_bot: boolean;
  bot_label: string | null;
  created_at: string;
}

interface ActivityResponse {
  summary: { total: number; humans: number; bots: number };
  repeatedIps: { ip: string; count: number }[];
  events: TrafficEvent[];
  error?: string;
}

const POLL_MS = 4000;

/**
 * components/admin/ActivityFeed.tsx
 * -----------------------------------
 * A genuinely live feed of real page traffic, bot and human both,
 * polling public.traffic_log every few seconds via GET /api/admin/activity.
 *
 * Polling rather than a websocket/SSE stream: this table can be written
 * from every page request on the site, so a push-based live connection
 * for an admin page that gets glanced at occasionally is more
 * infrastructure than the problem needs. Polling every 4s is close enough
 * to real time to watch traffic happen while staying simple.
 *
 * Incremental, not a full re-fetch each tick: after the first load, every
 * poll passes sinceId (the newest row already shown) and the response is
 * prepended rather than replacing the list, so rows do not visibly
 * reshuffle or reset scroll position every few seconds.
 */
export default function ActivityFeed() {
  const [events, setEvents] = useState<TrafficEvent[]>([]);
  const [summary, setSummary] = useState<ActivityResponse["summary"] | null>(null);
  const [repeatedIps, setRepeatedIps] = useState<ActivityResponse["repeatedIps"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const newestId = useRef<number | null>(null);

  const load = useCallback(async (incremental: boolean) => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (incremental && newestId.current !== null) {
        params.set("sinceId", String(newestId.current));
      }
      const res = await fetch(`/api/admin/activity?${params}`);
      const json: ActivityResponse = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);

      setSummary(json.summary);
      setRepeatedIps(json.repeatedIps);

      if (json.events.length > 0) {
        newestId.current = json.events[0].id;
      }

      setEvents((prev) => {
        const merged = incremental ? [...json.events, ...prev] : json.events;
        // Cap the client-side list so a long-open tab does not grow
        // memory unbounded; the server is the source of truth for counts.
        return merged.slice(0, 300);
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(interval);
  }, [live, load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-[12.5px] text-[var(--ink-soft)]">
          {summary && (
            <>
              <span><strong className="text-[var(--ink)]">{summary.total}</strong> in this window</span>
              <span className="flex items-center gap-1"><User size={13} className="text-[#2f7a4a]" /> {summary.humans} human</span>
              <span className="flex items-center gap-1"><Bot size={13} className="text-[var(--ink-faint)]" /> {summary.bots} bot</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLive((v) => !v)}
            className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            {live ? <Pause size={13} /> : <Play size={13} />}
            {live ? "Live" : "Paused"}
          </button>
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-[#fdecea] text-[#b3432f] text-[13px]">{error}</div>
      )}

      {repeatedIps.length > 0 && (
        <div className="mb-5 rounded-xl border border-[#fbd9cf] bg-[#fff7f5] p-3.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#b3432f] mb-2">
            IPs appearing more than once in this window
          </p>
          <div className="flex flex-wrap gap-2">
            {repeatedIps.map((r) => (
              <span key={r.ip} className="text-[12.5px] font-mono bg-white border border-[#fbd9cf] rounded-md px-2 py-1 text-[#8a3a2a]">
                {r.ip} <span className="text-[#b3432f] font-bold">×{r.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--line)] divide-y divide-[var(--line-subtle)] overflow-hidden max-h-[70vh] overflow-y-auto">
        {loading && events.length === 0 && (
          <div className="p-6 text-center text-[13px] text-[var(--ink-faint)]">Loading…</div>
        )}
        {!loading && events.length === 0 && (
          <div className="p-6 text-center text-[13px] text-[var(--ink-faint)]">No traffic in this window.</div>
        )}
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--line-subtle)]/40">
            <span
              className={`shrink-0 w-6 h-6 rounded-full grid place-items-center ${
                e.is_bot ? "bg-[var(--line-subtle)] text-[var(--ink-faint)]" : "bg-[#eaf6ee] text-[#2f7a4a]"
              }`}
            >
              {e.is_bot ? <Bot size={12} /> : <User size={12} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-mono text-[var(--ink)] truncate">{e.path}</span>
                {e.bot_label && (
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">
                    {e.bot_label}
                  </span>
                )}
              </div>
              {e.ip_address && (
                <span className="text-[11px] text-[var(--ink-faint)] font-mono">{e.ip_address}</span>
              )}
            </div>
            <span className="text-[11.5px] text-[var(--ink-faint)] shrink-0 tabular-nums">
              {new Date(e.created_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
