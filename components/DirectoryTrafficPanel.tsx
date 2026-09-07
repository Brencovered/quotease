interface TrafficDay {
  day: string;
  pageviews: number;
  cta_clicks: number;
}

/**
 * Basic version, deliberately scoped: total views and clicks over the
 * cached window, plus a simple day-by-day bar trend. No breakdown by
 * traffic source or specific CTA button yet - see
 * lib/directoryTrafficSync.ts header for why cta_clicks is a single
 * combined count for now rather than split by button. A richer
 * version (referrer sources, per-button breakdown, geographic split)
 * is a natural next iteration once this basic version is live and
 * the daily sync has real history to build on.
 */
export default function DirectoryTrafficPanel({ businessName, traffic }: { businessName: string; traffic: TrafficDay[] }) {
  if (traffic.length === 0) {
    return (
      <div className="card">
        <p className="section-tag mb-1">Your listing traffic</p>
        <p className="text-[13px] text-[var(--ink-faint)]">
          No traffic data yet for {businessName} - this updates once a day, check back tomorrow.
        </p>
      </div>
    );
  }

  const totalViews  = traffic.reduce((sum, d) => sum + d.pageviews, 0);
  const totalClicks = traffic.reduce((sum, d) => sum + d.cta_clicks, 0);
  const maxViews    = Math.max(...traffic.map(d => d.pageviews), 1);

  return (
    <div className="card space-y-4">
      <div>
        <p className="section-tag">Your listing traffic</p>
        <p className="text-[12px] text-[var(--ink-faint)] mt-0.5">
          Last {traffic.length} day{traffic.length !== 1 ? "s" : ""} for {businessName}, updated daily
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--app-bg)] rounded-xl px-3 py-2.5">
          <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">Page views</p>
          <p className="font-display text-[1.6rem] text-[var(--ink)]">{totalViews.toLocaleString()}</p>
        </div>
        <div className="bg-[var(--app-bg)] rounded-xl px-3 py-2.5">
          <p className="text-[10.5px] font-bold uppercase text-[var(--ink-faint)]">Clicks on your page</p>
          <p className="font-display text-[1.6rem] text-[var(--ink)]">{totalClicks.toLocaleString()}</p>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-2">Views by day</p>
        <div className="flex items-end gap-[3px] h-16">
          {traffic.map((d) => (
            <div
              key={d.day}
              title={`${d.day}: ${d.pageviews} view${d.pageviews !== 1 ? "s" : ""}`}
              className="flex-1 bg-[var(--amber)] rounded-t min-h-[2px] transition-all"
              style={{ height: `${Math.max((d.pageviews / maxViews) * 100, 3)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
