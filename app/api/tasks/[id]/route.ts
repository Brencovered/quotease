/**
 * PATCH  /api/tasks/[id] - update status / assignee / due / title
 * DELETE /api/tasks/[id]
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getTeamContext(supabase, userData.user.id);
  const body = (await request.json()) as {
    status?: string;
    title?: string;
    assignedToMemberId?: string | null;
    dueDate?: string | null;
    jobId?: string | null;
  };

  const patch: Record<string, unknown> = {};
  if (body.status === "done" || body.status === "todo") {
    patch.status = body.status;
    patch.completed_at = body.status === "done" ? new Date().toISOString() : null;
  }
  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim();
  }
  if (body.assignedToMemberId !== undefined) {
    patch.assigned_to_member_id = body.assignedToMemberId || null;
  }
  if (body.dueDate !== undefined) {
    patch.due_date = body.dueDate || null;
  }
  if (body.jobId !== undefined) {
    patch.job_id = body.jobId || null;
    if (body.jobId) {
      const { data: job } = await supabase
        .from("jobs")
        .select("quote_id")
        .eq("id", body.jobId)
        .eq("profile_id", ctx.businessId)
        .maybeSingle();
      if (job) patch.quote_id = job.quote_id;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("job_tasks")
    .update(patch)
    .eq("id", id)
    .eq("profile_id", ctx.businessId)
    .select(
      "id, title, status, due_date, assigned_to_member_id, job_id, quote_id, completed_at, created_at"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, task: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getTeamContext(supabase, userData.user.id);
  const { error } = await supabase
    .from("job_tasks")
    .delete()
    .eq("id", id)
    .eq("profile_id", ctx.businessId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
