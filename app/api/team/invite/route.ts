/**
 * POST /api/team/invite
 * ----------------------
 * Owner or admin only. Creates a team_members row (status "invited") and
 * emails the person an accept link. If they already have a Swiftscope
 * login, accepting just links their existing account -- no second signup
 * needed.
 *
 * Body: { email: string, name?: string, role?: "admin" | "member" }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getTeamContext(supabase, userData.user.id);
  if (!ctx.isOwner && ctx.role !== "admin") {
    return NextResponse.json({ error: "Only the owner or an admin can invite team members." }, { status: 403 });
  }

  const { email, name, role } = (await request.json()) as { email?: string; name?: string; role?: string };
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (cleanEmail === userData.user.email?.toLowerCase()) {
    return NextResponse.json({ error: "That's your own email." }, { status: 400 });
  }

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
      name: name?.trim() || null,
      role: role === "admin" ? "admin" : "member",
    })
    .select("id, invite_token")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already invited or already on the team." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

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
          to: [cleanEmail],
          subject: `You've been added to ${businessName} on Swiftscope`,
          html: `
            <p>${name ? `Hi ${name},` : "Hi,"}</p>
            <p><strong>${businessName}</strong> has added you as a team member on Swiftscope.</p>
            <p><a href="${acceptUrl}">Click here to accept and start working on their jobs and quotes</a>.</p>
            <p style="color:#888;font-size:12px">If you don't have a Swiftscope account yet, this link will let you create one.</p>
          `,
        }),
      });
    } catch (err) {
      console.error("[team/invite] failed to send email:", err);
      // Don't fail the request over a flaky email send -- the invite row
      // already exists, the owner can resend or just share the link.
    }
  }

  return NextResponse.json({ ok: true, acceptUrl });
}
