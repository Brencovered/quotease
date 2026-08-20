/**
 * POST /api/team/[id] - update role, remove, or resend invite for a team member
 * --------------------------------------------------------------------------------
 * Owner or admin only (enforced by RLS - "Owner manages team" and
 * "Admin manages team" policies).
 *
 * Body: { action: "remove" } | { action: "set_role", role: "admin" | "manager" | "site_member", accessScope?: "all" | "assigned_only" } | { action: "resend" }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamContext } from "@/lib/team";
import { ensureInviteAuthUser, teamInviteAcceptBaseUrl, teamInviteEmailHtml } from "@/lib/teamInvite";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getTeamContext(supabase, userData.user.id);
  if (!ctx.isOwner && ctx.role !== "admin") {
    return NextResponse.json({ error: "Only the owner or an admin can manage the team." }, { status: 403 });
  }

  const body = (await request.json()) as { action?: string; role?: string; accessScope?: string };

  if (body.action === "remove") {
    const { error } = await supabase
      .from("team_members")
      .update({ status: "removed" })
      .eq("id", id)
      .eq("owner_profile_id", ctx.businessId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_role") {
    const role = body.role === "admin" ? "admin" : body.role === "manager" ? "manager" : "site_member";
    const { error } = await supabase
      .from("team_members")
      .update({
        role,
        access_scope: role === "manager" ? (body.accessScope === "assigned_only" ? "assigned_only" : "all") : "all",
      })
      .eq("id", id)
      .eq("owner_profile_id", ctx.businessId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "resend") {
    const { data: invite, error } = await supabase
      .from("team_members")
      .select("id, email, name, role, invite_token, status, member_user_id")
      .eq("id", id)
      .eq("owner_profile_id", ctx.businessId)
      .single();
    if (error || !invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    if (invite.status !== "invited") return NextResponse.json({ error: "Already accepted" }, { status: 400 });

    const admin = createAdminClient();
    try {
      const { userId } = await ensureInviteAuthUser(admin, {
        email: invite.email,
        name: invite.name,
        inviteToken: invite.invite_token,
        ownerProfileId: ctx.businessId,
        role: invite.role,
      });
      if (!invite.member_user_id) {
        await admin
          .from("team_members")
          .update({ member_user_id: userId })
          .eq("id", invite.id)
          .eq("status", "invited");
      }
    } catch (err) {
      console.error("[team/resend] ensureInviteAuthUser failed:", err);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name")
      .eq("id", ctx.businessId)
      .single();
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
            to: [invite.email],
            subject: `Reminder: set your password for ${businessName} on Swiftscope`,
            html: teamInviteEmailHtml({
              name: invite.name,
              businessName,
              acceptUrl,
            }),
          }),
        });
      } catch (err) {
        console.error("[team/resend] failed to send email:", err);
        return NextResponse.json(
          { error: "Couldn't send the email - try again shortly." },
          { status: 502 }
        );
      }
    }
    return NextResponse.json({ ok: true, acceptUrl });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
