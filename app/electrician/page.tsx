import { createClient } from "@/lib/supabase/server";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";
import QuoteBuilder from "@/components/QuoteBuilder";

// Falls back to demo defaults if Supabase isn't reachable or no one's
// logged in — this page is for click-through navigation review right now,
// not real data. Re-add the auth/data requirement once the backend is live.
export default async function ElectricianPage() {
  let profile = { hourly_rate: 95, materials_margin_pct: 20 };
  let materials = ELECTRICIAN_DEFAULT_MATERIALS.map((m) => ({ ...m }));

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: dbProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .single();
      if (dbProfile) profile = dbProfile;

      const { data: dbMaterials } = await supabase
        .from("material_items")
        .select("*")
        .eq("profile_id", userData.user.id)
        .order("label");
      if (dbMaterials && dbMaterials.length > 0) materials = dbMaterials;
    }
  } catch (err) {
    console.error("Electrician page: falling back to demo data —", err);
  }

  return <QuoteBuilder profile={profile} materials={materials} />;
}
