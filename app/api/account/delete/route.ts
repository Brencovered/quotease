/**
 * POST /api/account/delete
 * -------------------------
 * Self-service. Soft-deletes the account: cancels any active Stripe
 * subscriptions immediately and marks deleted_at = now(). Nothing is
 * actually removed -- the tradie (or an admin) can restore within 30 days
 * via /api/account/restore. After 30 days the daily purge cron
 * permanently deletes it (see lib/deleteAccount.ts).
 *
 * Body: { confirmBusinessName: string }
 * Must exactly match the account's business_name (case-insensitive).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { softDeleteAccount } from "@/lib/deleteAccount";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { confirmBusinessName } = (await request.json().catch(() => ({}))) as { confirmBusinessName?: string };

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name")
    .eq("id", userData.user.id)
    .single();

  const expected = (profile?.business_name ?? "").trim().toLowerCase();
  if (!expected || (confirmBusinessName ?? "").trim().toLowerCase() !== expected) {
    return NextResponse.json({ error: "Business name didn't match -- account not deleted." }, { status: 400 });
  }

  const result = await softDeleteAccount(userData.user.id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, recoverableUntil: new Date(Date.now() + 30 * 86400000).toISOString() });
}
