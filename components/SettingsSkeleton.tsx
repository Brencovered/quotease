export default function SettingsSkeleton() {
  return (
    <div className="page-wrap-narrow pt-0" aria-hidden="true">
      <div className="card mb-4 flex items-center gap-4 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-[var(--app-bg)] shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="h-4 w-40 bg-[var(--app-bg)] rounded mb-2" />
          <div className="h-3 w-56 bg-[var(--app-bg)] rounded" />
        </div>
      </div>
      <div className="card mb-4 animate-pulse">
        <div className="h-4 w-32 bg-[var(--app-bg)] rounded mb-4" />
        <div className="h-24 bg-[var(--app-bg)] rounded" />
      </div>
      <div className="card animate-pulse">
        <div className="h-4 w-40 bg-[var(--app-bg)] rounded mb-4" />
        <div className="h-16 bg-[var(--app-bg)] rounded" />
      </div>
    </div>
  );
}
