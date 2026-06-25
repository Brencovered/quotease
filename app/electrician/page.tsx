import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";
import QuoteBuilder from "@/components/QuoteBuilder";

export default async function ElectricianPage() {
  let profile: { hourly_rate: number; materials_margin_pct: number; trades?: string[]; onboarded_at?: string | null } = {
    hourly_rate: 95,
    materials_margin_pct: 20,
  };
  let materials = ELECTRICIAN_DEFAULT_MATERIALS.map((m) => ({ ...m }));
  let needsOnboarding = false;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: dbProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .single();

      if (dbProfile) {
        if (!dbProfile.onboarded_at || !dbProfile.trades?.includes("electrician")) {
          needsOnboarding = true;
        } else {
          profile = dbProfile;
        }
      }

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

  // redirect() must run outside the try/catch above — it works by throwing
  // a control-flow signal internally, which the catch block would otherwise
  // swallow and log as a normal error, silently breaking the redirect.
  if (needsOnboarding) {
    redirect("/onboarding");
  }

  return <QuoteBuilder profile={profile} materials={materials} />;
}
