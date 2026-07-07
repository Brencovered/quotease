import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, user.id);

  const q      = req.nextUrl.searchParams.get("q") ?? "";
  const trade  = req.nextUrl.searchParams.get("trade") ?? "";
  const limit  = parseInt(req.nextUrl.searchParams.get("limit") ?? "20");

  if (!q || q.length < 2) return NextResponse.json({ items: [] });

  let query = supabase
    .from("price_book_items")
    .select("id, supplier, sku, description, unit, cost_price")
    .eq("profile_id", businessId)
    .ilike("description", `%${q}%`)
    .order("cost_price")
    .limit(limit);

  if (trade) {
    query = query.or(`trade.eq.${trade},trade.is.null`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
