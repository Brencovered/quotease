/**
 * POST /api/jobs/[id]/claim
 * Field worker (or any team member) claims an unassigned job for themselves.
 * Sets primary assignee + job_crew. No email to self.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getTeamContext(supabase, userData.user.id);

  // Owner claiming: treat as themselves only if they also have a team_members
  // row - owners usually assign via Crew. Allow owners to claim only when they
  // have an active membership row (unusual). Prefer: any active membership.
  const { data: membership } = await supabase
    .from("team_members")
    .select("id, name, email")
    .eq("member_user_id", userData.user.id)
    .eq("owner_profile_id", ctx.businessId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      {
        error:
          "Only team members can claim jobs. Owners assign from Crew.",
      },
      { status: 403 }
    );
  }

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, job_number, title, client_name, quote_id, assigned_to_member_id, status"
    )
    .eq("id", jobId)
    .eq("profile_id", ctx.businessId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (
    ["cancelled", "archived", "complete", "invoiced", "partially_paid"].includes(
      job.status
    )
  ) {
    return NextResponse.json(
      { error: "This job is already finished." },
      { status: 400 }
    );
  }

  if (job.assigned_to_member_id) {
    if (job.assigned_to_member_id === membership.id) {
      return NextResponse.json({ ok: true, alreadyYours: true });
    }
    return NextResponse.json(
      { error: "Someone already claimed this job." },
      { status: 409 }
    );
  }

  const { data: crewOnJob } = await supabase
    .from("job_crew")
    .select("team_member_id")
    .eq("job_id", jobId)
    .limit(1);

  if ((crewOnJob ?? []).length > 0) {
    return NextResponse.json(
      { error: "This job already has crew assigned - ask the boss." },
      { status: 409 }
    );
  }

  const { error: jobErr } = await supabase
    .from("jobs")
    .update({
      assigned_to_member_id: membership.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .is("assigned_to_member_id", null);

  if (jobErr) {
    return NextResponse.json({ error: jobErr.message }, { status: 500 });
  }

  // Re-check race
  const { data: after } = await supabase
    .from("jobs")
    .select("assigned_to_member_id")
    .eq("id", jobId)
    .single();

  if (after?.assigned_to_member_id !== membership.id) {
    return NextResponse.json(
      { error: "Someone else claimed it first." },
      { status: 409 }
    );
  }

  if (job.quote_id) {
    await supabase
      .from("quotes")
      .update({
        assigned_to_member_id: membership.id,
        assigned_to: membership.name || membership.email,
      })
      .eq("id", job.quote_id);
  }

  await supabase.from("job_crew").upsert(
    {
      job_id: jobId,
      team_member_id: membership.id,
      profile_id: ctx.businessId,
    },
    { onConflict: "job_id,team_member_id", ignoreDuplicates: true }
  );

  return NextResponse.json({
    ok: true,
    jobId,
    assignedToMemberId: membership.id,
  });
}
