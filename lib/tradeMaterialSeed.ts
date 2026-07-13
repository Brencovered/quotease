/**
 * lib/tradeMaterialSeed.ts
 * -------------------------
 * Default starter material_items for the 4 trades with a dedicated quote
 * builder (electrician, plumber, carpenter, roofer). Seeded once when a
 * trade is first set for an account -- previously this ran from Settings
 * whenever a trade was toggled on, but trade is now fixed at onboarding
 * and not changeable afterwards, so this runs once from the onboarding
 * flow instead (see app/onboarding/page.tsx).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";
import { PLUMBER_DEFAULT_MATERIALS } from "@/lib/calcPlumber";
import { CARPENTER_DEFAULT_MATERIALS } from "@/lib/calcCarpenter";
import { ROOFER_DEFAULT_MATERIALS } from "@/lib/calcRoofer";

export const TRADE_MATERIAL_SEED: Record<string, readonly { item_key: string; label: string; unit_cost: number }[]> = {
  electrician: ELECTRICIAN_DEFAULT_MATERIALS,
  plumber:     PLUMBER_DEFAULT_MATERIALS,
  carpenter:   CARPENTER_DEFAULT_MATERIALS,
  roofer:      ROOFER_DEFAULT_MATERIALS,
};

/**
 * Seeds default material_items for a trade, if defaults exist for it.
 * Safe to call more than once -- upserts on (profile_id, item_key), so it
 * won't duplicate or clobber prices the account has since customised.
 */
export async function seedDefaultMaterials(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  businessId: string,
  trade: string
): Promise<void> {
  const seed = TRADE_MATERIAL_SEED[trade];
  if (!seed) return;

  await supabase.from("material_items").upsert(
    seed.map((m) => ({ profile_id: businessId, trade, item_key: m.item_key, label: m.label, unit_cost: m.unit_cost })),
    { onConflict: "profile_id,item_key" }
  );
}
