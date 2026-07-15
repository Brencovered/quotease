/**
 * POST /api/jobs/[id]/crew
 * ------------------------
 * Adds a team member to a job's crew and notifies them - email always,
 * push if they've enabled it on a device. Moved out of a plain client-side
 * insert (which JobCrewPanel used to do directly) specifically so the
 * notification can fire: Resend and the VAPID private key are both
 * server-only secrets, so "add crew + notify" has to happen from a route,
 * not the browser.
 *
 * Body: { teamMemberId: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamContext } from "@/lib/team";
import { sendPushToUser } from "@/lib/push";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getTeamContext(supabase, userData.user.id);
  const { teamMemberId } = (await request.json()) as { teamMemberId?: string };
  if (!teamMemberId) {
    return NextResponse.json({ error: "teamMemberId is required" }, { status: 400 });
  }

  // job and team_member reads are both RLS-scoped to accessible_business_ids,
  // so this also acts as the access check - a team member outside this
  // business simply won't find either row.
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, site_address, scheduled_start")
    .eq("id", jobId)
    .single();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data: member } = await supabase
    .from("team_members")
    .select("id, name, email, member_user_id")
    .eq("id", teamMemberId)
    .single();
  if (!member) {
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  }

  const { data: crewRow, error: insertErr } = await supabase
    .from("job_crew")
    .insert({ job_id: jobId, team_member_id: teamMemberId, profile_id: ctx.businessId })
    .select("id, team_member_id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "They're already on this job." }, { status: 409 });
    }
    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }

  const jobTitle = job.title || "a job";
  const when = job.scheduled_start
    ? new Date(job.scheduled_start).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })
    : null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const jobUrl = `${appUrl}/electrician/jobs/${jobId}`;

  const admin = createAdminClient();

  if (RESEND_API_KEY && member.email) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Swiftscope <noreply@swiftscope.com.au>",
          to: [member.email],
          subject: `You've been added to a job: ${jobTitle}`,
          html: `
            <p>${member.name ? `Hi ${member.name},` : "Hi,"}</p>
            <p>You've been added to <strong>${jobTitle}</strong>${job.site_address ? ` at ${job.site_address}` : ""}${when ? `, scheduled for ${when}` : ""}.</p>
            <p><a href="${jobUrl}">View the job on Swiftscope</a> for drawings, materials, and site notes.</p>
          `,
        }),
      });
    } catch (err) {
      console.error("[jobs/crew] failed to send email:", err);
      // Same call as team/invite - the crew row already exists, don't
      // fail the request over a flaky email send.
    }
  }

  if (member.member_user_id) {
    await sendPushToUser(admin, member.member_user_id, {
      title: "Added to a job",
      body: `You're on ${jobTitle}${when ? ` - ${when}` : ""}`,
      url: `/electrician/jobs/${jobId}`,
    });
  }

  return NextResponse.json({ ok: true, crew: crewRow });
}
