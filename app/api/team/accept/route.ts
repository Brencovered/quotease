/**
 * POST /api/team/accept
 * ----------------------
 * Call once the invited person is logged in. Links their auth user to the
 * team_members row and flips it to "active". Requires their logged-in
 * email to match the invited email -- the invite link's token alone isn't
 * enough, so a forwarded/leaked link can't be used by someone else.
 *
 * Body: { token: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { token } = (await request.json()) as { token?: string };
  if (!token) {
    return NextResponse.json({ error: "Missing invite token" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: invite, error } = await admin
    .from("team_members")
    .select("id, email, status, owner_profile_id")
    .eq("invite_token", token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "This invite link isn't valid." }, { status: 404 });
  }
  if (invite.status === "removed") {
    return NextResponse.json({ error: "This invite has been revoked." }, { status: 410 });
  }
  if (invite.owner_profile_id === userData.user.id) {
    return NextResponse.json({ error: "You can't join your own business as a team member." }, { status: 400 });
  }
  if (invite.email.toLowerCase() !== (userData.user.email ?? "").toLowerCase()) {
    return NextResponse.json(
      { error: `This invite was sent to ${invite.email}. Log in with that email to accept it.` },
      { status: 403 }
    );
  }

  const { error: updateError } = await admin
    .from("team_members")
    .update({ member_user_id: userData.user.id, status: "active", joined_at: new Date().toISOString() })
    .eq("id", invite.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
