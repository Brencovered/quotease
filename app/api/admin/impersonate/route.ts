/**
 * POST /api/admin/impersonate
 * ----------------------------
 * Admin-only. Generates a one-time magic link that logs the caller's
 * browser in AS the target tradie account, for training/support purposes.
 * Every use is written to admin_impersonation_log.
 *
 * This does NOT touch the tradie's password and doesn't require it -- it
 * uses Supabase's admin "generate link" API, the same mechanism used for
 * password-reset/invite emails, except we never send the email and instead
 * hand the link straight back to the admin.
 *
 * Body: { profileId: string }
 * Output: { url: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const { profileId } = (await request.json()) as { profileId?: string };
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, business_name, contact_email")
    .eq("id", profileId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Tradie account not found" }, { status: 404 });
  }
  if (!profile.contact_email) {
    return NextResponse.json({ error: "This account has no email on file - can't generate a login link." }, { status: 400 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: profile.contact_email,
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[admin/impersonate] generateLink failed:", linkError);
    return NextResponse.json({ error: "Could not generate a login link" }, { status: 502 });
  }

  await admin.from("admin_impersonation_log").insert({
    admin_email: userData.user.email,
    target_profile_id: profile.id,
  });

  return NextResponse.json({ url: linkData.properties.action_link });
}
