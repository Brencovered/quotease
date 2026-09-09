"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Eye, Users, Clock, FileText } from "lucide-react";

type Overview = {
  total_pageviews: number;
  total_sessions: number;
  unique_visitors: number;
  distinct_pages: number;
  avg_session_duration_sec: number;
};

type SourceRow = { source: string; sessions: number };
type CountryRow = { country: string | null; sessions: number };
type PageRow = {
  page: string;
  pageviews: number;
  sessions: number;
  unique_visitors: number;
  avg_session_duration_sec: number;
  top_source: string;
  top_country: string | null;
};

type AnalyticsData = {
  windowDays: number;
  minSessionSeconds: number;
  overview: Overview | null;
  sources: SourceRow[];
  countries: CountryRow[];
  topPages: PageRow[];
  topTradiePages: PageRow[];
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-4">
      <div className="flex items-center gap-2 text-[var(--ink-faint)] mb-2">
        {icon}
        <span className="text-[11.5px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-display text-2xl text-[var(--ink)]">{value}</p>
      {sub && <p className="text-[12px] text-[var(--ink-faint)] mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-4 mb-6">
      <div className="mb-3">
        <h2 className="font-display text-[15px] text-[var(--ink)]">{title}</h2>
        {sub && <p className="text-[12px] text-[var(--ink-faint)]">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) {
          setError(body.error ?? "Failed to load analytics data");
          return;
        }
        setData(body);
      })
      .catch(() => setError("Failed to reach the server"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[var(--ink-faint)]" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-[13.5px] rounded-xl px-4 py-3 max-w-2xl">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold mb-1">Couldn&apos;t load PostHog data</p>
          <p className="text-[12.5px]">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { overview, sources, countries, topPages, topTradiePages } = data;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-[var(--ink)] mb-1">Analytics</h1>
        <p className="text-[13.5px] text-[var(--ink-soft)] max-w-2xl">
          Live from PostHog. Last {data.windowDays} days, sessions over {data.minSessionSeconds}s only
          (filters out bounces, prefetches, and most bot noise).
        </p>
      </div>

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={<Eye size={14} />} label="Pageviews" value={overview.total_pageviews.toLocaleString()} />
          <StatCard icon={<Users size={14} />} label="Sessions" value={overview.total_sessions.toLocaleString()} sub={`${overview.unique_visitors.toLocaleString()} unique visitors`} />
          <StatCard icon={<Clock size={14} />} label="Avg session" value={formatDuration(overview.avg_session_duration_sec)} sub="capped at 30 min" />
          <StatCard icon={<FileText size={14} />} label="Pages visited" value={overview.distinct_pages.toLocaleString()} />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-0 md:gap-6">
        <Section title="Entry sources" sub="Where sessions came from">
          <table className="w-full text-[13px]">
            <tbody>
              {sources.map((s) => (
                <tr key={s.source} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-1.5 text-[var(--ink)]">{s.source}</td>
                  <td className="py-1.5 text-right font-semibold text-[var(--ink)]">{s.sessions}</td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr><td className="py-3 text-[var(--ink-faint)]">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Section>

        <Section title="Country" sub="Where visitors are from">
          <table className="w-full text-[13px]">
            <tbody>
              {countries.map((c) => (
                <tr key={c.country ?? "unknown"} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-1.5 text-[var(--ink)]">{c.country ?? "Unknown"}</td>
                  <td className="py-1.5 text-right font-semibold text-[var(--ink)]">{c.sessions}</td>
                </tr>
              ))}
              {countries.length === 0 && (
                <tr><td className="py-3 text-[var(--ink-faint)]">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Section>
      </div>

      <Section title="Top pages" sub="Across the whole site">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--ink-faint)] border-b border-[var(--line)]">
                <th className="py-1.5 pr-3 font-semibold">Page</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Views</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Sessions</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Visitors</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Avg duration</th>
                <th className="py-1.5 font-semibold">Top source</th>
              </tr>
            </thead>
            <tbody>
              {topPages.map((p) => (
                <tr key={p.page} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-1.5 pr-3 text-[var(--ink)] font-mono text-[12px]">{p.page}</td>
                  <td className="py-1.5 pr-3 text-right">{p.pageviews}</td>
                  <td className="py-1.5 pr-3 text-right">{p.sessions}</td>
                  <td className="py-1.5 pr-3 text-right">{p.unique_visitors}</td>
                  <td className="py-1.5 pr-3 text-right">{formatDuration(p.avg_session_duration_sec)}</td>
                  <td className="py-1.5 text-[var(--ink-faint)]">{p.top_source}</td>
                </tr>
              ))}
              {topPages.length === 0 && (
                <tr><td className="py-3 text-[var(--ink-faint)]">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Tradie listings visited"
        sub="Individual /directory/[listing] pages - unclaimed listings getting traffic are good outreach targets"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--ink-faint)] border-b border-[var(--line)]">
                <th className="py-1.5 pr-3 font-semibold">Listing</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Views</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Sessions</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Visitors</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Avg duration</th>
                <th className="py-1.5 pr-3 font-semibold">Top source</th>
                <th className="py-1.5 font-semibold">Top country</th>
              </tr>
            </thead>
            <tbody>
              {topTradiePages.map((p) => (
                <tr key={p.page} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-1.5 pr-3">
                    <a
                      href={`https://swiftscope.com.au${p.page}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--amber)] hover:underline font-mono text-[12px]"
                    >
                      {p.page.replace("/directory/", "")}
                    </a>
                  </td>
                  <td className="py-1.5 pr-3 text-right">{p.pageviews}</td>
                  <td className="py-1.5 pr-3 text-right">{p.sessions}</td>
                  <td className="py-1.5 pr-3 text-right">{p.unique_visitors}</td>
                  <td className="py-1.5 pr-3 text-right">{formatDuration(p.avg_session_duration_sec)}</td>
                  <td className="py-1.5 pr-3 text-[var(--ink-faint)]">{p.top_source}</td>
                  <td className="py-1.5 text-[var(--ink-faint)]">{p.top_country ?? "-"}</td>
                </tr>
              ))}
              {topTradiePages.length === 0 && (
                <tr><td className="py-3 text-[var(--ink-faint)]">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
