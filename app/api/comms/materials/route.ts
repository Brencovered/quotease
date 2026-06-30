import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);
  const { data } = await supabase.from("material_items")
    .select("item_key, label, unit_cost, trade")
    .eq("profile_id", businessId)
    .order("label");
  return NextResponse.json({ materials: data ?? [] });
}
