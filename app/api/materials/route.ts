import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface PriceBookItem {
  id: string;
  profile_id: string;
  supplier: string | null;
  sku: string | null;
  description: string;
  unit: string | null;
  cost_price: number | null;
  trade: string | null;
  imported_at: string | null;
}

/* ------------------------------------------------------------------ */
/*  GET - list materials with filtering + distinct suppliers/trades    */
/* ------------------------------------------------------------------ */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const searchParams = request.nextUrl.searchParams;
  const supplierFilter = searchParams.get("supplier") ?? "";
  const tradeFilter    = searchParams.get("trade") ?? "";
  const q              = searchParams.get("q") ?? "";
  const limit          = parseInt(searchParams.get("limit") ?? "50", 10);
  const offset         = parseInt(searchParams.get("offset") ?? "0", 10);

  /* ---- build main query ---- */
  let dbQuery = supabase
    .from("price_book_items")
    .select("*", { count: "exact" })
    .eq("profile_id", businessId);

  if (supplierFilter) {
    dbQuery = dbQuery.ilike("supplier", `%${supplierFilter}%`);
  }

  if (tradeFilter) {
    dbQuery = dbQuery.ilike("trade", `%${tradeFilter}%`);
  }

  if (q) {
    dbQuery = dbQuery.or(
      `description.ilike.%${q}%,sku.ilike.%${q}%,supplier.ilike.%${q}%`
    );
  }

  const { data: items, error, count } = await dbQuery
    .order("description", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* ---- distinct suppliers ---- */
  const { data: supplierRows, error: supplierError } = await supabase
    .from("price_book_items")
    .select("supplier")
    .eq("profile_id", businessId)
    .not("supplier", "is", null);

  if (supplierError) {
    return NextResponse.json({ error: supplierError.message }, { status: 500 });
  }

  const suppliers = Array.from(
    new Set((supplierRows ?? []).map((r) => r.supplier).filter(Boolean))
  ).sort() as string[];

  /* ---- distinct trades ---- */
  const { data: tradeRows, error: tradeError } = await supabase
    .from("price_book_items")
    .select("trade")
    .eq("profile_id", businessId)
    .not("trade", "is", null);

  if (tradeError) {
    return NextResponse.json({ error: tradeError.message }, { status: 500 });
  }

  const trades = Array.from(
    new Set((tradeRows ?? []).map((r) => r.trade).filter(Boolean))
  ).sort() as string[];

  return NextResponse.json({
    materials: (items ?? []) as PriceBookItem[],
    total: count ?? 0,
    suppliers,
    trades,
  });
}

/* ------------------------------------------------------------------ */
/*  POST - create a material                                           */
/* ------------------------------------------------------------------ */
export async function POST(request: Request) {
  const body = await request.json();
  const { supplier, sku, description, unit, cost_price, trade } = body;

  if (!description) {
    return NextResponse.json(
      { error: "Missing required field: description" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: created, error } = await supabase
    .from("price_book_items")
    .insert({
      profile_id: businessId,
      supplier: supplier ?? null,
      sku: sku ?? null,
      description,
      unit: unit ?? null,
      cost_price: cost_price ?? null,
      trade: trade ?? null,
      imported_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: created });
}

/* ------------------------------------------------------------------ */
/*  PATCH - update a material                                          */
/* ------------------------------------------------------------------ */
export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = await request.json();
  const { supplier, sku, description, unit, cost_price, trade } = body;

  const updateData: Record<string, unknown> = {};
  if (supplier !== undefined)     updateData.supplier = supplier;
  if (sku !== undefined)          updateData.sku = sku;
  if (description !== undefined)  updateData.description = description;
  if (unit !== undefined)         updateData.unit = unit;
  if (cost_price !== undefined)   updateData.cost_price = cost_price;
  if (trade !== undefined)        updateData.trade = trade;
  updateData.imported_at = new Date().toISOString();

  if (Object.keys(updateData).length === 1) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: existing } = await supabase
    .from("price_book_items")
    .select("id")
    .eq("id", id)
    .eq("profile_id", businessId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  const { data: updated, error } = await supabase
    .from("price_book_items")
    .update(updateData)
    .eq("id", id)
    .eq("profile_id", businessId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: updated });
}

/* ------------------------------------------------------------------ */
/*  DELETE - remove a material                                         */
/* ------------------------------------------------------------------ */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: existing } = await supabase
    .from("price_book_items")
    .select("id")
    .eq("id", id)
    .eq("profile_id", businessId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("price_book_items")
    .delete()
    .eq("id", id)
    .eq("profile_id", businessId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
