/**
 * POST /api/team/[id] -- update role, remove, or resend invite for a team member
 * --------------------------------------------------------------------------------
 * Owner or admin: full control over anyone. Manager: can only manage
 * site_member rows (their own invitees), can't touch other managers/admins,
 * and can't promote anyone above site_member.
 *
 * Body: { action: "remove" }
 *     | { action: "set_role", role: "admin" | "manager" | "site_member", accessScope?: "all" | "assigned_only" }
 *     | { action: "resend" }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const VALID_ROLES = ["admin", "manager", "site_member"] as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getTeamContext(supabase, userData.user.id);
  const canManage = ctx.isOwner || ctx.role === "admin" || ctx.role === "manager";
  if (!canManage) {
    return NextResponse.json({ error: "Only the owner, an admin, or a manager can manage the team." }, { status: 403 });
  }

  // A manager's reach stops at the site_member rows they can see - they
  // can't touch another manager's or admin's row, can't remove/resend for
  // anyone else, and can't promote anyone past site_member.
  const isPlainManager = !ctx.isOwner && ctx.role === "manager";
  if (isPlainManager) {
    const { data: target } = await supabase.from("team_members").select("role").eq("id", id).eq("owner_profile_id", ctx.businessId).single();
    if (!target || target.role !== "site_member") {
      return NextResponse.json({ error: "As a manager, you can only manage site members." }, { status: 403 });
    }
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
    let role: (typeof VALID_ROLES)[number] = VALID_ROLES.includes(body.role as never) ? (body.role as (typeof VALID_ROLES)[number]) : "site_member";
    if (isPlainManager) role = "site_member"; // can't promote past their own tier
    const accessScope = body.accessScope === "assigned_only" ? "assigned_only" : "all";
    const { error } = await supabase
      .from("team_members")
      .update({ role, access_scope: accessScope })
      .eq("id", id)
      .eq("owner_profile_id", ctx.businessId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "resend") {
    const { data: invite, error } = await supabase
      .from("team_members")
      .select("email, name, invite_token, status")
      .eq("id", id)
      .eq("owner_profile_id", ctx.businessId)
      .single();
    if (error || !invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    if (invite.status !== "invited") return NextResponse.json({ error: "Already accepted" }, { status: 400 });

    const { data: profile } = await supabase.from("profiles").select("business_name").eq("id", ctx.businessId).single();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const acceptUrl = `${appUrl}/team/accept/${invite.invite_token}`;
    const businessName = profile?.business_name || "their Swiftscope account";

    if (RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Swiftscope <noreply@swiftscope.com.au>",
            to: [invite.email],
            subject: `Reminder: you've been added to ${businessName} on Swiftscope`,
            html: `
              <p>${invite.name ? `Hi ${invite.name},` : "Hi,"}</p>
              <p>Just a reminder -- <strong>${businessName}</strong> has added you as a team member on Swiftscope.</p>
              <p><a href="${acceptUrl}">Click here to accept</a>.</p>
            `,
          }),
        });
      } catch (err) {
        console.error("[team/resend] failed to send email:", err);
        return NextResponse.json({ error: "Couldn't send the email -- try again shortly." }, { status: 502 });
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
