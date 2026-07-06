import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase.from("timesheets").select("*").eq("job_id", jobId).order("work_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { jobId, teamMemberId, memberName, hours, workDate, notes } = body;
  if (!jobId || !memberName || !hours) {
    return NextResponse.json({ error: "jobId, memberName, and hours are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  // Resolve the rate to snapshot: the member's own rate if set, else the
  // business default.
  let rate: number | null = null;
  if (teamMemberId) {
    const { data: member } = await supabase.from("team_members").select("hourly_rate").eq("id", teamMemberId).single();
    rate = member?.hourly_rate ?? null;
  }
  if (rate == null) {
    const { data: profile } = await supabase.from("profiles").select("hourly_rate").eq("id", businessId).single();
    rate = profile?.hourly_rate ?? 95;
  }

  const { data, error } = await supabase
    .from("timesheets")
    .insert({
      profile_id: businessId,
      job_id: jobId,
      team_member_id: teamMemberId ?? null,
      member_name: memberName,
      hours: Number(hours),
      hourly_rate_used: rate,
      work_date: workDate ?? new Date().toISOString().slice(0, 10),
      notes: notes ?? null,
      created_by: userData.user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true, entry: data });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { error } = await supabase.from("timesheets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
