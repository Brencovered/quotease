import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface BundleItem {
  label: string;
  qty: number;
  unit: string;
  unit_cost: number;
}

/* ------------------------------------------------------------------ */
/*  GET - list material bundles with items                             */
/* ------------------------------------------------------------------ */
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: bundles, error } = await supabase
    .from("material_bundles")
    .select("*, material_bundle_items(*)")
    .eq("profile_id", businessId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const transformed = (bundles ?? []).map((b) => ({
    ...b,
    items: (b.material_bundle_items ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
    material_bundle_items: undefined,
  }));

  return NextResponse.json({ bundles: transformed });
}

/* ------------------------------------------------------------------ */
/*  POST - create a material bundle with items                         */
/* ------------------------------------------------------------------ */
export async function POST(request: Request) {
  const body = await request.json();
  const { title, trade, description, items } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Missing required field: title" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: bundle, error: bundleError } = await supabase
    .from("material_bundles")
    .insert({
      profile_id: businessId,
      title: title.trim(),
      trade: trade ?? "electrician",
      description: description?.trim() || null,
      status: "active",
    })
    .select()
    .single();

  if (bundleError || !bundle) {
    return NextResponse.json({ error: bundleError?.message || "Failed to create bundle" }, { status: 500 });
  }

  const validItems = (items ?? []).filter((it: BundleItem) => it.label?.trim() && it.qty > 0);

  if (validItems.length > 0) {
    const { error: itemsError } = await supabase.from("material_bundle_items").insert(
      validItems.map((it: BundleItem, i: number) => ({
        bundle_id: bundle.id,
        label: it.label.trim(),
        qty: it.qty,
        unit: it.unit || "each",
        unit_cost: it.unit_cost ?? 0,
        sort_order: i,
      }))
    );

    if (itemsError) {
      await supabase.from("material_bundles").delete().eq("id", bundle.id);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
  }

  const { data: complete, error: fetchError } = await supabase
    .from("material_bundles")
    .select("*, material_bundle_items(*)")
    .eq("id", bundle.id)
    .single();

  if (fetchError) return NextResponse.json({ bundle });

  return NextResponse.json({
    bundle: { ...complete, items: complete.material_bundle_items ?? [], material_bundle_items: undefined },
  });
}

/* ------------------------------------------------------------------ */
/*  PATCH - update bundle + replace items                              */
/* ------------------------------------------------------------------ */
export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, title, trade, description, items } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: existing } = await supabase.from("material_bundles").select("id").eq("id", id).eq("profile_id", businessId).single();
  if (!existing) return NextResponse.json({ error: "Bundle not found" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title.trim();
  if (trade !== undefined) updateData.trade = trade;
  if (description !== undefined) updateData.description = description?.trim() || null;

  if (Object.keys(updateData).length > 0) {
    const { error: updateError } = await supabase.from("material_bundles").update(updateData).eq("id", id).eq("profile_id", businessId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (items !== undefined) {
    await supabase.from("material_bundle_items").delete().eq("bundle_id", id);
    const validItems = items.filter((it: BundleItem) => it.label?.trim() && it.qty > 0);
    if (validItems.length > 0) {
      const { error: itemsError } = await supabase.from("material_bundle_items").insert(
        validItems.map((it: BundleItem, i: number) => ({
          bundle_id: id, label: it.label.trim(), qty: it.qty,
          unit: it.unit || "each", unit_cost: it.unit_cost ?? 0, sort_order: i,
        }))
      );
      if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
  }

  const { data: complete, error: fetchError } = await supabase.from("material_bundles").select("*, material_bundle_items(*)").eq("id", id).single();
  if (fetchError) return NextResponse.json({ ok: true });

  return NextResponse.json({
    bundle: { ...complete, items: complete.material_bundle_items ?? [], material_bundle_items: undefined },
  });
}

/* ------------------------------------------------------------------ */
/*  DELETE - soft delete                                               */
/* ------------------------------------------------------------------ */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: existing } = await supabase.from("material_bundles").select("id").eq("id", id).eq("profile_id", businessId).single();
  if (!existing) return NextResponse.json({ error: "Bundle not found" }, { status: 404 });

  const { error } = await supabase.from("material_bundles").update({ status: "deleted" }).eq("id", id).eq("profile_id", businessId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
