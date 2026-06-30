import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

/* GET - list materials with filters */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { searchParams } = new URL(request.url);
  const supplier = searchParams.get("supplier");
  const trade = searchParams.get("trade");
  const q = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  // Build count query
  let countQuery = supabase.from("price_book_items").select("*", { count: "exact", head: true }).eq("profile_id", businessId);
  if (supplier) countQuery = countQuery.eq("supplier", supplier);
  if (trade) countQuery = countQuery.eq("trade", trade);
  if (q) countQuery = countQuery.or(`description.ilike.%${q}%,sku.ilike.%${q}%`);
  const { count } = await countQuery;

  // Build data query
  let dataQuery = supabase.from("price_book_items").select("*").eq("profile_id", businessId).order("description", { ascending: true }).range(offset, offset + limit - 1);
  if (supplier) dataQuery = dataQuery.eq("supplier", supplier);
  if (trade) dataQuery = dataQuery.eq("trade", trade);
  if (q) dataQuery = dataQuery.or(`description.ilike.%${q}%,sku.ilike.%${q}%`);
  const { data: items, error } = await dataQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get distinct suppliers and trades for filter dropdowns
  const { data: allItems } = await supabase.from("price_book_items").select("supplier, trade").eq("profile_id", businessId);
  const suppliers = [...new Set((allItems ?? []).map((i) => i.supplier).filter(Boolean))].sort();
  const trades = [...new Set((allItems ?? []).map((i) => i.trade).filter(Boolean))].sort();

  return NextResponse.json({ items: items ?? [], total: count ?? 0, suppliers, trades });
}

/* POST - create a material */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { description, sku, supplier, unit, cost_price, trade } = await request.json();
  if (!description || !supplier || cost_price === undefined || cost_price === null) {
    return NextResponse.json({ error: "Description, supplier, and cost_price are required" }, { status: 400 });
  }

  const { data: item, error } = await supabase.from("price_book_items").insert({
    profile_id: businessId,
    description,
    sku: sku || null,
    supplier,
    unit: unit || "ea",
    cost_price: Number(cost_price),
    trade: trade || "electrician",
    imported_at: new Date().toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item });
}

/* PATCH - update a material */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of ["description", "sku", "supplier", "unit", "cost_price", "trade"]) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  const { data: item, error } = await supabase.from("price_book_items").update(update).eq("id", id).eq("profile_id", businessId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item });
}

/* DELETE - remove a material */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("price_book_items").delete().eq("id", id).eq("profile_id", businessId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
