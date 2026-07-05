/**
 * POST /api/account/delete
 * -------------------------
 * Self-service, permanent account deletion. Cancels any active Stripe
 * subscriptions, then deletes the profile (cascading to all quotes,
 * clients, price book items, etc.) and the login itself.
 *
 * Body: { confirmBusinessName: string }
 * Must exactly match the account's business_name (case-insensitive) --
 * this is deliberately awkward to trigger by accident, there is no undo.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteAccount } from "@/lib/deleteAccount";

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

  const result = await deleteAccount(userData.user.id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
