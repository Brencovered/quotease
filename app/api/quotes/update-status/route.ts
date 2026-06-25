import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_STATUSES = ["draft", "sent", "accepted", "declined", "paid"];

export async function POST(request: Request) {
  const { quoteId, status } = await request.json();
  if (!quoteId || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid quoteId or status" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "accepted") update.accepted_at = new Date().toISOString();
  if (status === "paid") update.paid_at = new Date().toISOString();

  const { error } = await supabase
    .from("quotes")
    .update(update)
    .eq("id", quoteId)
    .eq("profile_id", userData.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
