import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const intent = searchParams.get("intent");
  const segment = searchParams.get("segment");
  const search = searchParams.get("search");
  const sortBy = searchParams.get("sortBy") ?? "volume";
  const sortDir = searchParams.get("sortDir") ?? "desc";

  const supabase = await createClient();

  let query = supabase.from("seo_keywords").select("*", { count: "exact" });

  if (status) query = query.eq("status", status);
  if (intent) query = query.eq("intent", intent);
  if (segment) query = query.eq("segment", segment);
  if (search) query = query.ilike("keyword", `%${search}%`);

  const validCols = ["keyword", "intent", "volume", "keyword_difficulty", "cpc_usd", "status", "created_at", "current_position"];
  const col = validCols.includes(sortBy) ? sortBy : "volume";
  query = query.order(col, { ascending: sortDir === "asc", nullsFirst: false });

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keywords: data ?? [], total: count ?? 0 });
}

export async function PATCH(request: Request) {
  const { id, status, notes, segment } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (segment) updates.segment = segment;

  const { data, error } = await supabase
    .from("seo_keywords")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keyword: data });
}
