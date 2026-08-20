/**
 * POST /api/jobs/[id]/assign
 * Set primary assignee, ensure they're on job_crew, notify (email + push → My day).
 * Body: { teamMemberId: string | null }
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
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const ctx = await getTeamContext(supabase, userData.user.id);
  const body = await request.json();
  const teamMemberId =
    body.teamMemberId === null || body.teamMemberId === ""
      ? null
      : String(body.teamMemberId);

  const { data: job } = await supabase
    .from("jobs")
    .select("id, site_address, scheduled_start, scheduled_date, quote_id, job_number, client_name, assigned_to_member_id")
    .eq("id", jobId)
    .eq("profile_id", ctx.businessId)
    .single();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  let member: { id: string; name: string | null; email: string | null; member_user_id: string | null } | null = null;
  if (teamMemberId) {
    const { data } = await supabase
      .from("team_members")
      .select("id, name, email, member_user_id")
      .eq("id", teamMemberId)
      .eq("owner_profile_id", ctx.businessId)
      .single();
    if (!data) return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    member = data;
  }

  // Optional start date (YYYY-MM-DD) - assign + schedule in one action so My day fills.
  const scheduledStartRaw =
    typeof body.scheduledStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.scheduledStart)
      ? body.scheduledStart
      : null;
  const scheduledStartIso = scheduledStartRaw
    ? new Date(`${scheduledStartRaw}T09:00:00`).toISOString()
    : null;

  const jobPatch: Record<string, unknown> = {
    assigned_to_member_id: teamMemberId,
    updated_at: new Date().toISOString(),
  };
  if (scheduledStartIso) {
    jobPatch.scheduled_date = scheduledStartRaw;
    jobPatch.scheduled_start = scheduledStartIso;
  }

  const { error: jobErr } = await supabase.from("jobs").update(jobPatch).eq("id", jobId);
  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

  if (job.quote_id) {
    const quotePatch: Record<string, unknown> = {
      assigned_to_member_id: teamMemberId,
      assigned_to: member ? member.name || member.email : null,
    };
    if (scheduledStartIso) {
      quotePatch.scheduled_date = scheduledStartRaw;
      quotePatch.scheduled_start = scheduledStartIso;
    }
    await supabase.from("quotes").update(quotePatch).eq("id", job.quote_id);
  }

  if (member) {
    await supabase.from("job_crew").upsert(
      {
        job_id: jobId,
        team_member_id: member.id,
        profile_id: ctx.businessId,
      },
      { onConflict: "job_id,team_member_id", ignoreDuplicates: true }
    );

    const jobLabel = job.job_number != null ? `Job #${job.job_number}` : "a job";
    const address = (job.site_address ?? "").trim() || null;
    const whenSource = scheduledStartIso || job.scheduled_start || job.scheduled_date;
    const when = whenSource
      ? new Date(
          typeof whenSource === "string" && whenSource.length === 10
            ? `${whenSource}T12:00:00`
            : whenSource
        ).toLocaleDateString("en-AU", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })
      : null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const todayUrl = `${appUrl}/today`;
    const subjectBits = [jobLabel, address].filter(Boolean);
    const whereBits = [
      `<strong>${jobLabel}</strong>`,
      address ? `at <strong>${address}</strong>` : null,
      when,
    ].filter(Boolean);

    if (RESEND_API_KEY && member.email) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Swiftscope <noreply@swiftscope.com.au>",
            to: [member.email],
            subject: `You're on: ${subjectBits.join(" · ")}`,
            html: `
              <p>${member.name ? `Hi ${member.name},` : "Hi,"}</p>
              <p>You've been assigned to ${whereBits.join(", ")}.</p>
              <p><a href="${todayUrl}">Open My day</a> to call, navigate, and run the job.</p>
            `,
          }),
        });
      } catch (err) {
        console.error("[jobs/assign] email failed:", err);
      }
    }

    if (member.member_user_id && teamMemberId !== job.assigned_to_member_id) {
      await sendPushToUser(createAdminClient(), member.member_user_id, {
        title: "You're on a job",
        body: [jobLabel, address, when].filter(Boolean).join(" · "),
        url: `/today`,
      });
    }
  }

  return NextResponse.json({ ok: true, assignedToMemberId: teamMemberId });
}
