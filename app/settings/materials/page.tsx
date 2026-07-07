import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import MaterialPricingPanel from "@/components/MaterialPricingPanel";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActiveBusinessId } from "@/lib/team";

export default async function MaterialsPage() {
  let trades: string[] = ["electrician"];
  let hourlyRate = 95;
  let marginPct  = 20;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const businessId = await getActiveBusinessId(supabase, user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("trades, hourly_rate, materials_margin_pct")
        .eq("id", businessId)
        .single();
      if (profile) {
        trades     = profile.trades ?? ["electrician"];
        hourlyRate = profile.hourly_rate ?? 95;
        marginPct  = profile.materials_margin_pct ?? 20;
      }
    }
  } catch { /* fallback */ }

  return (
    <>
      <AppHeader />
      <div className="page-wrap-narrow">

        <Link href="/settings" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors mb-5">
          <ArrowLeft size={14} /> Back to Settings
        </Link>

        <div className="mb-6">
          <h1 className="font-display text-[28px] text-[var(--ink)] mb-1">Material Pricing</h1>
          <p className="text-[14px] text-[var(--ink-faint)]">
            Set your supplier costs for every line item. Swiftscope uses these to calculate
            quote totals - your margin is added on top automatically.
          </p>
        </div>

        {/* Rate + margin summary */}
        <div className="card mb-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] mb-1">Your hourly rate</p>
            <p className="font-display text-[28px] text-[var(--ink)] leading-none">${hourlyRate}<span className="text-[16px] text-[var(--ink-faint)]">/hr</span></p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] mb-1">Materials margin</p>
            <p className="font-display text-[28px] text-[var(--ink)] leading-none">{marginPct}%</p>
          </div>
          <p className="col-span-2 text-[12.5px] text-[var(--ink-faint)]">
            Change these in <Link href="/settings" className="underline">Settings</Link>. They apply to every new quote.
          </p>
        </div>

        <MaterialPricingPanel trades={trades} />
      </div>
    </>
  );
}
