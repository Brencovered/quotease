import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";

export interface DocketsQuickViewDocket {
  id: string;
  status: string;
  total_cost: number;
}

export default function DocketsQuickView({ dockets }: { dockets: DocketsQuickViewDocket[] }) {
  const signed = dockets.filter((d) => d.status === "signed");
  const awaiting = dockets.filter((d) => d.status === "draft" || d.status === "sent");
  const signedTotal = signed.reduce((sum, d) => sum + d.total_cost, 0);

  if (signed.length === 0 && awaiting.length === 0) return null;

  return (
    <Link href="/dockets" className="block bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5 mb-4 hover:border-[var(--ink-faint)] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold">Dayworks dockets</p>
        <span className="text-[12.5px] font-semibold text-[var(--navy)]">View all →</span>
      </div>
      <div className="flex flex-wrap gap-4">
        {signed.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <CheckCircle2 size={15} className="text-green-700" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-[var(--ink)]">${signedTotal.toLocaleString()}</p>
              <p className="text-[12px] text-[var(--ink-faint)]">{signed.length} signed - ready to invoice</p>
            </div>
          </div>
        )}
        {awaiting.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Clock size={15} className="text-amber-700" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-[var(--ink)]">{awaiting.length}</p>
              <p className="text-[12px] text-[var(--ink-faint)]">awaiting signature</p>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
