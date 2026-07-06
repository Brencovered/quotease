import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { memberId, rate } = await request.json();
  if (!memberId || typeof rate !== "number") {
    return NextResponse.json({ error: "memberId and numeric rate are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { error } = await supabase.rpc("set_member_hourly_rate", { p_member_id: memberId, p_rate: rate });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  return NextResponse.json({ ok: true });
}
