/**
 * POST /api/account/restore
 * ---------------------------
 * Owner or admin only. Un-deletes the business's account within the
 * 30-day recovery window (deleted_at is cleared). If the purge cron has
 * already run, the account and login no longer exist and this can't
 * help -- that's expected, the window has closed.
 *
 * No body needed; the business is resolved from the session.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { restoreAccount } from "@/lib/deleteAccount";
import { getTeamContext } from "@/lib/team";

export async function POST() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getTeamContext(supabase, userData.user.id);
  if (!ctx.isOwner && ctx.role !== "admin") {
    return NextResponse.json({ error: "Only the owner or an admin can restore this account." }, { status: 403 });
  }

  const result = await restoreAccount(ctx.businessId);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ restored: true });
}
