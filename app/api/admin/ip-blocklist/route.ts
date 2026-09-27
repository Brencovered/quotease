import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

/**
 * Manages public.ip_blocklist, which app/api/directory/claim already
 * checks against (lib/ipBlocklist.ts) - that check existed with no way
 * to actually add or remove an entry except raw SQL. This is that
 * missing piece, not a new blocking mechanism.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ip_blocklist")
    .select("ip_address, reason, blocked_by, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blocked: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  let body: { ip?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ip = typeof body.ip === "string" ? body.ip.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!ip || !reason) {
    return NextResponse.json({ error: "ip and reason are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("ip_blocklist")
    .upsert({ ip_address: ip, reason, blocked_by: user.email }, { onConflict: "ip_address" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const ip = req.nextUrl.searchParams.get("ip");
  if (!ip) {
    return NextResponse.json({ error: "ip query param is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("ip_blocklist").delete().eq("ip_address", ip);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
