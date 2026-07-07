export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-[var(--line)] border-t-[var(--navy)]" />
      </div>
      <p className="text-[13px] font-semibold text-[var(--ink-faint)]">Loading schedule...</p>
    </div>
  );
}
