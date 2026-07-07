import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import PriceBookPanel from "@/components/PriceBookPanel";
import { getActiveBusinessId } from "@/lib/team";

export default async function PriceBookPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const businessId = await getActiveBusinessId(supabase, user.id);

  const { data: items } = await supabase
    .from("price_book_items")
    .select("id, supplier, sku, description, unit, cost_price, trade, imported_at")
    .eq("profile_id", businessId)
    .order("supplier")
    .order("description");

  // Supplier summary counts
  const supplierCounts: Record<string, number> = {};
  for (const item of items ?? []) {
    supplierCounts[item.supplier] = (supplierCounts[item.supplier] ?? 0) + 1;
  }

  return (
    <>
      <AppHeader />
      <div className="page-wrap-narrow">
        <div className="mb-6">
          <h1 className="font-display text-[26px] text-[var(--ink)]">Supplier Price Book</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
            Import your supplier price lists. Prices auto-fill when building quotes.
          </p>
        </div>
        <PriceBookPanel
          items={items ?? []}
          supplierCounts={supplierCounts}
        />
      </div>
    </>
  );
}
