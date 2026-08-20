/**
 * lib/tradeMaterialSeed.ts
 * -------------------------
 * Default starter material_items for every product trade. Dedicated trades
 * use their calc-engine defaults; generic trades use GENERIC_TRADE_TEMPLATES
 * materials (labour lines are skipped - those come from packages / quote).
 *
 * Seeded once at onboarding via seedDefaultMaterials(). Also seeds a
 * starter package per trade so the first quote isn't an empty book.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";
import { PLUMBER_DEFAULT_MATERIALS } from "@/lib/calcPlumber";
import { CARPENTER_DEFAULT_MATERIALS } from "@/lib/calcCarpenter";
import { ROOFER_DEFAULT_MATERIALS } from "@/lib/calcRoofer";
import { GENERIC_TRADE_TEMPLATES } from "@/lib/genericTrades";

function slugKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}

function materialsFromGenericTemplate(tradeKey: string): { item_key: string; label: string; unit_cost: number }[] {
  const tpl = GENERIC_TRADE_TEMPLATES[tradeKey];
  if (!tpl) return [];
  return tpl.defaultItems
    .filter((i) => !i.is_labour)
    .map((i) => ({
      item_key: slugKey(i.label) || `item_${Math.random().toString(36).slice(2, 8)}`,
      label: i.label,
      unit_cost: i.unit_cost,
    }));
}

export const TRADE_MATERIAL_SEED: Record<string, readonly { item_key: string; label: string; unit_cost: number }[]> = {
  electrician: ELECTRICIAN_DEFAULT_MATERIALS,
  plumber: PLUMBER_DEFAULT_MATERIALS,
  carpenter: CARPENTER_DEFAULT_MATERIALS,
  roofer: ROOFER_DEFAULT_MATERIALS,
  painter: materialsFromGenericTemplate("painter"),
  tiler: materialsFromGenericTemplate("tiler"),
  landscaper: materialsFromGenericTemplate("landscaper"),
  arborist: materialsFromGenericTemplate("arborist"),
  concreter: materialsFromGenericTemplate("concreter"),
  fencer: materialsFromGenericTemplate("fencer"),
  aircon: materialsFromGenericTemplate("aircon"),
  surveyor: materialsFromGenericTemplate("surveyor"),
  custom: materialsFromGenericTemplate("custom"),
};

/**
 * Seeds default material_items for a trade, if defaults exist for it.
 * Safe to call more than once - upserts on (profile_id, item_key).
 */
export async function seedDefaultMaterials(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  businessId: string,
  trade: string
): Promise<void> {
  const seed = TRADE_MATERIAL_SEED[trade];
  if (!seed?.length) return;

  await supabase.from("material_items").upsert(
    seed.map((m) => ({
      profile_id: businessId,
      trade,
      item_key: m.item_key,
      label: m.label,
      unit_cost: m.unit_cost,
    })),
    { onConflict: "profile_id,item_key" }
  );
}

/**
 * Seeds one starter package from the trade's generic template (or a simple
 * labour+materials package for dedicated trades) so PackagePicker isn't empty.
 * Skips if the business already has any package for that trade.
 */
export async function seedDefaultPackage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  businessId: string,
  trade: string
): Promise<void> {
  const { count } = await supabase
    .from("packages")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", businessId)
    .eq("trade", trade);

  if ((count ?? 0) > 0) return;

  const tpl = GENERIC_TRADE_TEMPLATES[trade];
  const title = tpl ? `${tpl.label} - starter package` : "Starter package";
  const description = tpl
    ? `Starter scope for ${tpl.jobTypes[0] ?? "typical jobs"}. Edit quantities to match the site.`
    : "Edit this package or build your own from the materials book.";

  const labourHours = tpl
    ? tpl.defaultItems.filter((i) => i.is_labour && i.unit === "hr").reduce((s, i) => s + i.qty, 0)
    : 4;

  const packageItems = (tpl?.defaultItems ?? [])
    .filter((i) => !i.is_labour)
    .map((i, idx) => ({
      label: i.label,
      qty: i.qty,
      unit: i.unit === "item" ? "ea" : i.unit,
      unit_cost: i.unit_cost,
      sort_order: idx,
    }));

  // Dedicated trades without a generic template get a minimal materials stub
  // from TRADE_MATERIAL_SEED (first few items).
  if (!packageItems.length) {
    const seed = TRADE_MATERIAL_SEED[trade] ?? [];
    seed.slice(0, 5).forEach((m, idx) => {
      packageItems.push({
        label: m.label,
        qty: 1,
        unit: "ea",
        unit_cost: m.unit_cost,
        sort_order: idx,
      });
    });
  }

  const { data: pkg, error } = await supabase
    .from("packages")
    .insert({
      profile_id: businessId,
      title,
      trade,
      description,
      labour_hours: labourHours || null,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !pkg) {
    console.error("[seedDefaultPackage] package insert failed:", error?.message);
    return;
  }

  if (packageItems.length) {
    await supabase.from("package_items").insert(
      packageItems.map((item) => ({ ...item, package_id: pkg.id }))
    );
  }
}

/** Materials + starter package for a trade. */
export async function seedTradeBook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  businessId: string,
  trade: string
): Promise<void> {
  await seedDefaultMaterials(supabase, businessId, trade);
  await seedDefaultPackage(supabase, businessId, trade);
}
