import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import MaterialPricingPanel from "@/components/MaterialPricingPanel";
import PriceBookPanel from "@/components/PriceBookPanel";
import PackagesPanel from "@/components/PackagesPanel";
import Link from "next/link";

export default async function MaterialsAndPricingPage() {
  let trades: string[] = ["electrician"];
  let hourlyRate = 95;
  let marginPct  = 20;
  let priceBookItems: Array<{ id: string; supplier: string; sku: string | null; description: string; unit: string; cost_price: number; trade: string | null; imported_at: string }> = [];
  let packages: Array<{ id: string; trade: string; name: string; description: string | null; items: { item_key: string; label: string; qty: number; unit_cost: number }[]; labour_hours: number }> = [];
  const supplierCounts: Record<string, number> = {};

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const businessId = await getActiveBusinessId(supabase, user.id);
      const [{ data: profile }, { data: items }, { data: pkgs }] = await Promise.all([
        supabase.from("profiles").select("trades, hourly_rate, materials_margin_pct").eq("id", businessId).single(),
        supabase.from("price_book_items").select("id, supplier, sku, description, unit, cost_price, trade, imported_at").eq("profile_id", businessId).order("supplier").order("description"),
        supabase.from("job_packages").select("*").eq("profile_id", businessId).order("created_at", { ascending: false }),
      ]);
      if (profile) {
        trades = profile.trades ?? ["electrician"];
        hourlyRate = profile.hourly_rate ?? 95;
        marginPct = profile.materials_margin_pct ?? 20;
      }
      priceBookItems = items ?? [];
      packages = pkgs ?? [];
      for (const item of priceBookItems) supplierCounts[item.supplier] = (supplierCounts[item.supplier] ?? 0) + 1;
    }
  } catch (err) {
    console.error("Materials & Pricing page:", err);
  }

  return (
    <>
      <AppHeader />
      <div className="page-wrap-narrow">
        <div className="mb-6">
          <h1 className="font-display text-[28px] text-[var(--ink)] mb-1">Materials &amp; Pricing</h1>
          <p className="text-[14px] text-[var(--ink-faint)]">
            Everything that feeds a quote total in one place — your rate, your materials, your supplier prices, and reusable job packages.
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

        <div className="space-y-6">
          <PackagesPanel trades={trades} initialPackages={packages} />
          <MaterialPricingPanel trades={trades} />
          <div>
            <p className="section-tag mb-1">Supplier price book</p>
            <p className="text-[12.5px] text-[var(--ink-faint)] mb-3">
              Import your supplier price lists. Prices auto-fill when building quotes.
            </p>
            <PriceBookPanel items={priceBookItems} supplierCounts={supplierCounts} />
          </div>
        </div>
      </div>
    </>
  );
}
