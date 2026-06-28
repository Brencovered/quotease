import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("profiles").update({
    xero_tenant_id:       null,
    xero_access_token:    null,
    xero_refresh_token:   null,
    xero_token_expires_at: null,
    xero_connected_at:    null,
  }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}
