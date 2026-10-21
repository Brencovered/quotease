/**
 * Low-opacity accounting stack wordmarks for marketing trust.
 * Text-based marks (not trademarked logo artwork) so they read instantly.
 * Xero is live; MYOB and QuickBooks are listed as coming soon.
 */
export default function AccountingLogos({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const muted = tone === "light" ? "text-[#3d4f5c]" : "text-[#c5d4e0]";
  const label = tone === "light" ? "text-[#5a6a78]" : "text-[#9eb0bf]";
  const live = tone === "light" ? "text-[#1c7a3a] bg-[#e8f5ec]" : "text-[#8fd9a4] bg-white/10";
  const soon = tone === "light" ? "text-[#3d4f5c] bg-[#f0f2f4]" : "text-[#c5d4e0] bg-white/10";

  return (
    <div className={className}>
      <p className={`font-sans text-[11px] font-bold tracking-[0.16em] uppercase ${label} mb-2`}>
        Works with your books
      </p>
      <p className={`font-sans text-[12.5px] leading-snug ${label} mb-3 max-w-[48ch]`}>
        Xero invoice push is live. MYOB and QuickBooks are coming soon.
      </p>
      <ul className={`flex flex-col items-start gap-y-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 max-w-full ${muted}`} aria-label="Accounting integrations">
        <li className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-sans text-[1.15rem] sm:text-[1.25rem] font-bold tracking-tight">Xero</span>
          <span className={`font-sans text-[10px] font-bold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded whitespace-nowrap ${live}`}>
            Live
          </span>
        </li>
        <li className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-sans text-[1.15rem] sm:text-[1.25rem] font-bold tracking-tight">MYOB</span>
          <span className={`font-sans text-[10px] font-bold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded whitespace-nowrap ${soon}`}>
            Coming soon
          </span>
        </li>
        <li className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-sans text-[1.05rem] sm:text-[1.15rem] font-bold tracking-tight">
            QuickBooks
          </span>
          <span className={`font-sans text-[10px] font-bold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded whitespace-nowrap ${soon}`}>
            Coming soon
          </span>
        </li>
      </ul>
    </div>
  );
}
