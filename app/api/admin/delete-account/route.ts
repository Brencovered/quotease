/**
 * POST /api/admin/delete-account
 * --------------------------------
 * Admin-only. Permanently deletes a tradie account: cancels any active
 * Stripe subscriptions, deletes the profile (cascading to quotes, clients,
 * price book items, job attachments, everything else tied to it -- see
 * lib/deleteAccount.ts for exactly what that touches), and removes their
 * login. No undo.
 *
 * Body: { profileId: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { deleteAccount } from "@/lib/deleteAccount";

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

  const result = await deleteAccount(profileId);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
