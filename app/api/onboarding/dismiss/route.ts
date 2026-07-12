/**
 * POST /api/onboarding/dismiss
 * -----------------------------
 * Lets a business permanently hide the trial onboarding checklist widget.
 * Body: { dismissed?: boolean }  -- defaults to true; pass false to
 * bring the widget back (not currently exposed in the UI, but keeps the
 * endpoint symmetric rather than write-only).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  let dismissed = true;
  try {
    const body = await request.json();
    if (typeof body?.dismissed === "boolean") dismissed = body.dismissed;
  } catch {
    // no body -- default to dismissing
  }

  const { error } = await supabase
    .from("onboarding_state")
    .upsert({ profile_id: businessId, dismissed }, { onConflict: "profile_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dismissed });
}
