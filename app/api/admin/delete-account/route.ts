/**
 * POST /api/admin/delete-account
 * --------------------------------
 * Admin-only. Default action is a 30-day soft delete (cancels billing,
 * sets deleted_at) -- same recoverable flow as the tradie's own delete
 * button, but admin-triggered. Pass action: "purge_now" to skip the
 * waiting period and permanently delete immediately (irreversible).
 *
 * Body: { profileId: string, action?: "soft_delete" | "purge_now" }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { softDeleteAccount, purgeAccount } from "@/lib/deleteAccount";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const { profileId, action } = (await request.json().catch(() => ({}))) as {
    profileId?: string;
    action?: "soft_delete" | "purge_now";
  };
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const result = action === "purge_now" ? await purgeAccount(profileId) : await softDeleteAccount(profileId);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    deleted: true,
    purged: action === "purge_now",
    recoverableUntil: action === "purge_now" ? null : new Date(Date.now() + 30 * 86400000).toISOString(),
  });
}
