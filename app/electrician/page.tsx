import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QuoteBuilder from "@/components/QuoteBuilder";

export default async function ElectricianPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  const { data: materials } = await supabase
    .from("material_items")
    .select("*")
    .eq("profile_id", userData.user.id)
    .order("label");

  return (
    <QuoteBuilder
      profile={profile ?? { hourly_rate: 95, materials_margin_pct: 20 }}
      materials={materials ?? []}
    />
  );
}
