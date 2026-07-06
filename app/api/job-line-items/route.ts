import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: items, error } = await supabase
    .from("job_line_items")
    .select("*")
    .eq("job_id", jobId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: items ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { jobId, label, quantity, unit, sortOrder } = body;

  if (!jobId || !label?.trim()) {
    return NextResponse.json({ error: "Missing jobId or label" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: job } = await supabase.from("jobs").select("profile_id").eq("id", jobId).single();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data: item, error } = await supabase
    .from("job_line_items")
    .insert({
      job_id: jobId,
      profile_id: job.profile_id,
      label: label.trim(),
      quantity: quantity ?? 1,
      unit: unit ?? "ea",
      sort_order: sortOrder ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item });
}
