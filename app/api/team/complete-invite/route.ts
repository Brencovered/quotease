import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureInviteAuthUser,
  findAuthUserIdByEmail,
  getInviteByToken,
} from "@/lib/teamInvite";

type Body = {
  token?: string;
  password?: string;
};

/**
 * Completes a team invite for a new (or existing) invitee:
 * 1. Sets / updates their Auth password
 * 2. Activates the team_members row (member_user_id + joined_at)
 * 3. Returns email so the client can signInWithPassword → /dashboard
 *
 * Does NOT send them through /signup — they join the inviting company.
 */
export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ error: "Invite token is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const invite = await getInviteByToken(admin, token);
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.status === "active") {
    return NextResponse.json(
      {
        error:
          "This invite has already been accepted. Sign in with your email and password.",
      },
      { status: 409 }
    );
  }
  if (invite.status === "removed") {
    return NextResponse.json({ error: "This invite is no longer valid" }, { status: 410 });
  }
  if (invite.status !== "invited") {
    return NextResponse.json({ error: "This invite cannot be accepted" }, { status: 400 });
  }

  const email = invite.email.trim().toLowerCase();

  let authUserId: string | null = invite.member_user_id;
  if (!authUserId) {
    authUserId = await findAuthUserIdByEmail(admin, email);
  }

  if (!authUserId) {
    try {
      const ensured = await ensureInviteAuthUser(admin, {
        email,
        name: invite.name,
        inviteToken: token,
        ownerProfileId: invite.owner_profile_id,
        role: invite.role,
      });
      authUserId = ensured.userId;
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Could not create account for this invite",
        },
        { status: 500 }
      );
    }
  }

  if (authUserId === invite.owner_profile_id) {
    return NextResponse.json(
      { error: "You can't join your own business as a team member." },
      { status: 400 }
    );
  }

  const { error: pwError } = await admin.auth.admin.updateUserById(authUserId, {
    password,
    email_confirm: true,
    user_metadata: {
      full_name: invite.name,
      signup_source: "team_invite",
      invite_token: token,
      company_id: invite.owner_profile_id,
      invited_role: invite.role,
    },
  });
  if (pwError) {
    return NextResponse.json(
      { error: pwError.message || "Could not set password" },
      { status: 500 }
    );
  }

  // Ensure stub profile is marked onboarded (invitees never run owner onboarding).
  // Access to the business comes from team_members, not this profile's subscription.
  await admin
    .from("profiles")
    .update({
      contact_email: email,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", authUserId)
    .is("onboarded_at", null);

  const { error: updateError } = await admin
    .from("team_members")
    .update({
      status: "active",
      member_user_id: authUserId,
      joined_at: new Date().toISOString(),
    })
    .eq("id", invite.id)
    .eq("status", "invited");

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Could not activate invite" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    email,
    name: invite.name,
    role: invite.role,
    businessId: invite.owner_profile_id,
  });
}
