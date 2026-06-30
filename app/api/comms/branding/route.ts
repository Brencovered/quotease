import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

/* GET - fetch branding for business */
export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);
  const { data } = await supabase.from("profiles")
    .select("business_name, logo_url, branding_primary_color, branding_tagline, branding_email_footer, contact_email, contact_phone")
    .eq("id", businessId)
    .single();
  return NextResponse.json(data ?? {});
}

/* POST - update branding */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);
  const { primaryColor, tagline, emailFooter } = await request.json();
  const { error } = await supabase.from("profiles").update({
    branding_primary_color: primaryColor,
    branding_tagline: tagline,
    branding_email_footer: emailFooter,
    updated_at: new Date().toISOString(),
  }).eq("id", businessId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
