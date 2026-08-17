import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data, error } = await supabase
    .from("supplier_contacts")
    .select("id, supplier_name, email, phone, account_number, notes, created_at, updated_at")
    .eq("profile_id", businessId)
    .order("supplier_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const body = await request.json();
  const supplierName = String(body.supplierName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!supplierName || !email) {
    return NextResponse.json({ error: "Supplier name and email are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("supplier_contacts")
    .upsert(
      {
        profile_id: businessId,
        supplier_name: supplierName,
        email,
        phone: body.phone ? String(body.phone).trim() : null,
        account_number: body.accountNumber ? String(body.accountNumber).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,supplier_name,email" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const body = await request.json();
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Contact id is required" }, { status: 400 });

  const supplierName = String(body.supplierName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!supplierName || !email) {
    return NextResponse.json({ error: "Supplier name and email are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("supplier_contacts")
    .update({
      supplier_name: supplierName,
      email,
      phone: body.phone ? String(body.phone).trim() : null,
      account_number: body.accountNumber ? String(body.accountNumber).trim() : null,
      notes: body.notes ? String(body.notes).trim() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("profile_id", businessId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Contact id is required" }, { status: 400 });

  const { error } = await supabase
    .from("supplier_contacts")
    .delete()
    .eq("id", id)
    .eq("profile_id", businessId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
