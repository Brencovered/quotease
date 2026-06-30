import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: rows, error } = await supabase
    .from("price_book_items")
    .select("supplier, cost_price")
    .eq("profile_id", businessId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate by supplier
  const agg: Record<string, { count: number; totalCost: number }> = {};
  for (const row of rows ?? []) {
    const name = row.supplier || "Unnamed supplier";
    agg[name] = agg[name] ?? { count: 0, totalCost: 0 };
    agg[name].count++;
    agg[name].totalCost += row.cost_price ?? 0;
  }

  const suppliers = Object.entries(agg)
    .map(([name, { count, totalCost }]) => ({ name, count, totalCost: Math.round(totalCost * 100) / 100 }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ suppliers });
}
