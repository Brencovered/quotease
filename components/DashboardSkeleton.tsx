export default function DashboardSkeleton() {
  return (
    <div className="page-wrap pt-0" aria-hidden="true">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-3 w-20 bg-[var(--app-bg)] rounded mb-3" />
            <div className="h-6 w-14 bg-[var(--app-bg)] rounded" />
          </div>
        ))}
      </div>
      <div className="card mb-6 animate-pulse">
        <div className="h-4 w-32 bg-[var(--app-bg)] rounded mb-4" />
        <div className="h-16 bg-[var(--app-bg)] rounded" />
      </div>
      <div className="card animate-pulse">
        <div className="h-4 w-40 bg-[var(--app-bg)] rounded mb-4" />
        <div className="h-24 bg-[var(--app-bg)] rounded" />
      </div>
    </div>
  );
}
