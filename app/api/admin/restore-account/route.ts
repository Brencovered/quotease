/**
 * POST /api/admin/restore-account
 * ----------------------------------
 * Admin-only. Clears deleted_at on a soft-deleted account, within the
 * 30-day window before the purge cron runs.
 *
 * Body: { profileId: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { restoreAccount } from "@/lib/deleteAccount";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const { profileId } = (await request.json().catch(() => ({}))) as { profileId?: string };
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const result = await restoreAccount(profileId);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ restored: true });
}
