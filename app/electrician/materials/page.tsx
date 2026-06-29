import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import MaterialsPricingTabs from "@/components/MaterialsPricingTabs";

export default async function MaterialsAndPricingPage() {
  let trades: string[] = ["electrician"];
  let hourlyRate = 95;
  let marginPct  = 20;
  let priceBookItems: Array<{ id: string; supplier: string; sku: string | null; description: string; unit: string; cost_price: number; trade: string | null; imported_at: string }> = [];
  let packages: Array<{ id: string; trade: string; name: string; description: string | null; items: { item_key: string; label: string; qty: number; unit_cost: number }[]; labour_hours: number }> = [];
  let allMaterials: Array<{ item_key: string; label: string; unit_cost: number; trade: string }> = [];
  const supplierCounts: Record<string, number> = {};

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const businessId = await getActiveBusinessId(supabase, user.id);
      const [{ data: profile }, { data: items }, { data: pkgs }, { data: mats }] = await Promise.all([
        supabase.from("profiles").select("trades, hourly_rate, materials_margin_pct").eq("id", businessId).single(),
        supabase.from("price_book_items").select("id, supplier, sku, description, unit, cost_price, trade, imported_at").eq("profile_id", businessId).order("supplier").order("description"),
        supabase.from("job_packages").select("*").eq("profile_id", businessId).order("created_at", { ascending: false }),
        supabase.from("material_items").select("item_key, label, unit_cost, trade").eq("profile_id", businessId).order("label"),
      ]);
      if (profile) {
        trades = profile.trades ?? ["electrician"];
        hourlyRate = profile.hourly_rate ?? 95;
        marginPct = profile.materials_margin_pct ?? 20;
      }
      priceBookItems = items ?? [];
      packages = pkgs ?? [];
      allMaterials = mats ?? [];
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

        <MaterialsPricingTabs
          trades={trades}
          hourlyRate={hourlyRate}
          marginPct={marginPct}
          priceBookItems={priceBookItems}
          supplierCounts={supplierCounts}
          packages={packages}
          allMaterials={allMaterials}
        />
      </div>
    </>
  );
}
