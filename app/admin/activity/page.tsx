import ActivityFeed from "@/components/admin/ActivityFeed";

export const dynamic = "force-dynamic";

export default function AdminActivityPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-[var(--ink)] mb-1">Activity</h1>
        <p className="text-[13.5px] text-[var(--ink-soft)] max-w-2xl">
          Real page-level traffic, updating every few seconds, bot and human both - including Googlebot,
          prefetches and other crawler activity, which is deliberate: seeing that traffic is the point of
          this page, not something filtered out.
        </p>
        <p className="text-[12.5px] text-[var(--ink-faint)] mt-2 max-w-2xl">
          Written by middleware.ts on every page request (excludes static assets and image
          optimisation). Bot classification only recognises verified, self-identifying crawlers
          (Googlebot, Bingbot, Ahrefs, Semrush and similar) - anything unrecognised is shown as human by
          default. IPs appearing more than once in the current window are called out separately below;
          that repeat-IP signal is what caught 103.78.46.30 originally.
        </p>
      </div>
      <ActivityFeed />
    </div>
  );
}
