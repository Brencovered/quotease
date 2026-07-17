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
  const checkExists = req.nextUrl.searchParams.get("checkExists") === "1";

  // Cheap existence check (limit 1, no search term) so the UI can tell
  // "you have a price book but this search matched nothing" apart from
  // "you don't have a price book at all" - previously both cases looked
  // identical (an empty items array), so a zero-result search on a
  // 2,000+ item price book was mislabelled as "No price book".
  if (checkExists) {
    let existsQuery = supabase
      .from("price_book_items")
      .select("id")
      .eq("profile_id", businessId)
      .limit(1);
    if (trade) existsQuery = existsQuery.or(`trade.eq.${trade},trade.is.null`);
    const { data: existsData, error: existsError } = await existsQuery;
    if (existsError) return NextResponse.json({ error: existsError.message }, { status: 500 });
    return NextResponse.json({ hasAny: (existsData?.length ?? 0) > 0 });
  }

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
