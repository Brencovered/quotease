/**
 * GET  /api/tasks — list open (or all) tasks for the business
 * POST /api/tasks — create a job-linked or standalone task
 *
 * Body (POST): {
 *   title: string
 *   jobId?: string | null
 *   quoteId?: string | null
 *   assignedToMemberId?: string | null
 *   dueDate?: string | null  // YYYY-MM-DD
 * }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getTeamContext(supabase, userData.user.id);
  const url = new URL(request.url);
  const openOnly = url.searchParams.get("open") !== "0";
  const memberId = url.searchParams.get("memberId");
  const due = url.searchParams.get("due"); // YYYY-MM-DD or "today"

  let query = supabase
    .from("job_tasks")
    .select(
      "id, title, status, due_date, assigned_to_member_id, job_id, quote_id, completed_at, created_at, jobs:job_id(id, job_number, client_name, title)"
    )
    .eq("profile_id", ctx.businessId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (openOnly) query = query.neq("status", "done");
  if (memberId) query = query.eq("assigned_to_member_id", memberId);
  if (due === "today") {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Melbourne",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    query = query.eq("due_date", today);
  } else if (due) {
    query = query.eq("due_date", due);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getTeamContext(supabase, userData.user.id);
  const body = (await request.json()) as {
    title?: string;
    jobId?: string | null;
    quoteId?: string | null;
    assignedToMemberId?: string | null;
    dueDate?: string | null;
  };

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  let quoteId = body.quoteId ?? null;
  const jobId = body.jobId ?? null;

  if (jobId && !quoteId) {
    const { data: job } = await supabase
      .from("jobs")
      .select("id, quote_id")
      .eq("id", jobId)
      .eq("profile_id", ctx.businessId)
      .maybeSingle();
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    quoteId = job.quote_id;
  }

  if (body.assignedToMemberId) {
    const { data: member } = await supabase
      .from("team_members")
      .select("id")
      .eq("id", body.assignedToMemberId)
      .eq("owner_profile_id", ctx.businessId)
      .maybeSingle();
    if (!member) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("job_tasks")
    .insert({
      profile_id: ctx.businessId,
      title,
      job_id: jobId,
      quote_id: quoteId,
      assigned_to_member_id: body.assignedToMemberId || null,
      due_date: body.dueDate || null,
      status: "todo",
    })
    .select(
      "id, title, status, due_date, assigned_to_member_id, job_id, quote_id, completed_at, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, task: data });
}
