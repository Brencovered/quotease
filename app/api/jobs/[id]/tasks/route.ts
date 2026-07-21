/**
 * POST /api/jobs/[id]/tasks
 * -------------------------
 * Creates a job task and, if it's assigned to someone, notifies them -
 * email always, push if they've enabled it. Same reason as crew/route.ts:
 * Resend and the VAPID key are server-only secrets, so "create + notify"
 * has to happen from a route, not the browser's direct insert this used
 * to be.
 *
 * Body: { quoteId?: string | null, title: string, assignedToMemberId?: string | null }
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
  const { quoteId, title, assignedToMemberId } = (await request.json()) as {
    quoteId?: string | null;
    title?: string;
    assignedToMemberId?: string | null;
  };
  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const { data: job } = await supabase.from("jobs").select("id, title").eq("id", jobId).single();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data: task, error: insertErr } = await supabase
    .from("job_tasks")
    .insert({
      quote_id: quoteId || null,
      job_id: jobId,
      profile_id: ctx.businessId,
      title: title.trim(),
      assigned_to_member_id: assignedToMemberId || null,
    })
    .select()
    .single();

  if (insertErr || !task) {
    return NextResponse.json({ error: insertErr?.message ?? "Could not create task" }, { status: 400 });
  }

  if (assignedToMemberId) {
    const { data: member } = await supabase
      .from("team_members")
      .select("id, name, email, member_user_id")
      .eq("id", assignedToMemberId)
      .single();

    if (member) {
      const jobTitle = job.title || "a job";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
      const jobUrl = `${appUrl}/jobs/${jobId}`;
      const admin = createAdminClient();

      if (RESEND_API_KEY && member.email) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Swiftscope <noreply@swiftscope.com.au>",
              to: [member.email],
              subject: `New task on ${jobTitle}: ${task.title}`,
              html: `
                <p>${member.name ? `Hi ${member.name},` : "Hi,"}</p>
                <p>You've been assigned a task on <strong>${jobTitle}</strong>:</p>
                <p style="font-size:16px;font-weight:bold;">${task.title}</p>
                <p><a href="${jobUrl}">View the job on Swiftscope</a>.</p>
              `,
            }),
          });
        } catch (err) {
          console.error("[jobs/tasks] failed to send email:", err);
          // The task row already exists - don't fail the request over a flaky send.
        }
      }

      if (member.member_user_id) {
        await sendPushToUser(admin, member.member_user_id, {
          title: "New task assigned",
          body: `${task.title} on ${jobTitle}`,
          url: `/jobs/${jobId}`,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, task });
}
