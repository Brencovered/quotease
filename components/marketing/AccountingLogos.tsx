/**
 * Low-opacity accounting stack wordmarks for marketing trust.
 * Text-based marks (not trademarked logo artwork) so they read instantly.
 */
export default function AccountingLogos({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const muted = tone === "light" ? "text-[#071018]/35" : "text-white/35";
  const label = tone === "light" ? "text-[#5a6a78]" : "text-white/45";

  return (
    <div className={className}>
      <p className={`font-sans text-[11px] font-bold tracking-[0.16em] uppercase ${label} mb-3`}>
        Works with your books
      </p>
      <ul className={`flex flex-wrap items-center gap-x-8 gap-y-3 ${muted}`} aria-label="Accounting integrations">
        <li>
          <span className="font-sans text-[1.15rem] sm:text-[1.25rem] font-bold tracking-tight">Xero</span>
        </li>
        <li>
          <span className="font-sans text-[1.15rem] sm:text-[1.25rem] font-bold tracking-tight">MYOB</span>
        </li>
        <li>
          <span className="font-sans text-[1.05rem] sm:text-[1.15rem] font-bold tracking-tight">
            QuickBooks
          </span>
        </li>
      </ul>
    </div>
  );
}
