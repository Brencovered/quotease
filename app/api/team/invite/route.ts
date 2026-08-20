/**
 * POST /api/team/invite
 * ----------------------
 * Owner or admin only. Creates a team_members row (status "invited"),
 * provisions an Auth user for the invitee (no password yet), and emails
 * a link to set their password and join the company - not /signup.
 *
 * Body: { email: string, name?: string, role?: "admin" | "manager" | "site_member", accessScope?: "all" | "assigned_only" }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamContext } from "@/lib/team";
import { ensureInviteAuthUser, teamInviteAcceptBaseUrl, teamInviteEmailHtml } from "@/lib/teamInvite";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getTeamContext(supabase, userData.user.id);
  if (!ctx.isOwner && ctx.role !== "admin") {
    return NextResponse.json(
      { error: "Only the owner or an admin can invite team members." },
      { status: 403 }
    );
  }

  const { email, name, role, accessScope } = (await request.json()) as {
    email?: string;
    name?: string;
    role?: string;
    accessScope?: string;
  };
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (cleanEmail === userData.user.email?.toLowerCase()) {
    return NextResponse.json({ error: "That's your own email." }, { status: 400 });
  }

  const cleanRole =
    role === "admin" ? "admin" : role === "manager" ? "manager" : "site_member";
  const cleanName = name?.trim() || null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name")
    .eq("id", ctx.businessId)
    .single();

  const { data: invite, error } = await supabase
    .from("team_members")
    .insert({
      owner_profile_id: ctx.businessId,
      email: cleanEmail,
      name: cleanName,
      role: cleanRole,
      ...(cleanRole === "manager"
        ? { access_scope: accessScope === "assigned_only" ? "assigned_only" : "all" }
        : {}),
    })
    .select("id, invite_token")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Already invited or already on the team." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    const { userId } = await ensureInviteAuthUser(admin, {
      email: cleanEmail,
      name: cleanName,
      inviteToken: invite.invite_token,
      ownerProfileId: ctx.businessId,
      role: cleanRole,
    });
    // Link auth user early; stay "invited" until they set a password / accept.
    await admin
      .from("team_members")
      .update({ member_user_id: userId })
      .eq("id", invite.id)
      .eq("status", "invited");
  } catch (err) {
    console.error("[team/invite] ensureInviteAuthUser failed:", err);
    // Invite row still exists - accept page can provision on complete-invite.
  }

  const appUrl = teamInviteAcceptBaseUrl(request);
  const acceptUrl = `${appUrl}/team/accept/${invite.invite_token}`;
  const businessName = profile?.business_name || "their Swiftscope account";

  if (RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Swiftscope <noreply@swiftscope.com.au>",
          to: [cleanEmail],
          subject: `You've been added to ${businessName} on Swiftscope`,
          html: teamInviteEmailHtml({
            name: cleanName,
            businessName,
            acceptUrl,
          }),
        }),
      });
    } catch (err) {
      console.error("[team/invite] failed to send email:", err);
    }
  }

  return NextResponse.json({ ok: true, acceptUrl });
}
