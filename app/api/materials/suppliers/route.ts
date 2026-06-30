import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

/* ------------------------------------------------------------------ */
/*  GET - list unique suppliers with material count and total cost     */
/* ------------------------------------------------------------------ */
export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  /* ---- fetch all items for this business to aggregate locally ---- */
  const { data: items, error } = await supabase
    .from("price_book_items")
    .select("supplier, cost_price")
    .eq("profile_id", businessId)
    .not("supplier", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* ---- aggregate by supplier ---- */
  const agg = new Map<
    string,
    { name: string; count: number; total_value: number }
  >();

  for (const row of items ?? []) {
    const name = (row.supplier ?? "Unknown").trim();
    if (!agg.has(name)) {
      agg.set(name, { name, count: 0, total_value: 0 });
    }
    const entry = agg.get(name)!;
    entry.count += 1;
    entry.total_value += Number(row.cost_price ?? 0);
  }

  const suppliers = Array.from(agg.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return NextResponse.json({ suppliers });
}
