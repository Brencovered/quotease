import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import { generateIngestionEmail } from "@/lib/supplierEmail";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const businessId = await getActiveBusinessId(supabase, userData.user.id);
  const [{ data: suppliers }, { data: catalog }] = await Promise.all([
    supabase.from("business_suppliers").select("*").eq("profile_id", businessId).order("created_at", { ascending: false }),
    supabase.from("supplier_catalog").select("*").order("sort_order"),
  ]);

  return NextResponse.json({ suppliers: suppliers ?? [], catalog: catalog ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { catalogKey, name, contactEmail } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const businessId = await getActiveBusinessId(supabase, userData.user.id);
  const ingestionEmail = await generateIngestionEmail(supabase);

  const { data, error } = await supabase
    .from("business_suppliers")
    .insert({
      profile_id: businessId,
      catalog_key: catalogKey ?? null,
      name,
      contact_email: contactEmail ?? null,
      ingestion_email: ingestionEmail,
      status: "pending_approval",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, supplier: data });
}
