/**
 * POST /api/team/[id] -- update role, remove, or resend invite for a team member
 * --------------------------------------------------------------------------------
 * Owner-only (enforced by RLS -- the "Owner manages team" policy already
 * restricts updates/deletes on team_members to auth.uid() = owner_profile_id).
 *
 * Body: { action: "remove" } | { action: "set_role", role: "admin" | "member" } | { action: "resend" }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as { action?: string; role?: string };

  if (body.action === "remove") {
    const { error } = await supabase
      .from("team_members")
      .update({ status: "removed" })
      .eq("id", id)
      .eq("owner_profile_id", userData.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_role") {
    const role = body.role === "admin" ? "admin" : "member";
    const { error } = await supabase
      .from("team_members")
      .update({ role })
      .eq("id", id)
      .eq("owner_profile_id", userData.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "resend") {
    const { data: invite, error } = await supabase
      .from("team_members")
      .select("email, name, invite_token, status")
      .eq("id", id)
      .eq("owner_profile_id", userData.user.id)
      .single();
    if (error || !invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    if (invite.status !== "invited") return NextResponse.json({ error: "Already accepted" }, { status: 400 });

    const { data: profile } = await supabase.from("profiles").select("business_name").eq("id", userData.user.id).single();
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
