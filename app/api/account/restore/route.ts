/**
 * POST /api/account/restore
 * ---------------------------
 * Self-service. Un-deletes the logged-in account within the 30-day
 * recovery window (deleted_at is cleared). If the purge cron has already
 * run, the account and login no longer exist and this can't help --
 * that's expected, the window has closed.
 *
 * No body needed; profile is resolved from the session.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { restoreAccount } from "@/lib/deleteAccount";

export async function POST() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await restoreAccount(userData.user.id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ restored: true });
}
