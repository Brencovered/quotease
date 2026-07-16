import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const jobIdsParam = searchParams.get("jobIds");

  if (!jobId && !jobIdsParam) {
    return NextResponse.json({ error: "Missing jobId or jobIds" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Batch mode: the kanban board previously fired one of these requests
  // per visible job on mount (N round-trips, each with its own auth check).
  // jobIds pulls line items for every job in a single query and groups
  // them by job_id, so the board can make one request instead of N.
  if (jobIdsParam) {
    const jobIds = jobIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (jobIds.length === 0) {
      return NextResponse.json({ itemsByJobId: {} });
    }

    const { data: items, error } = await supabase
      .from("job_line_items")
      .select("*")
      .in("job_id", jobIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const itemsByJobId: Record<string, unknown[]> = {};
    for (const item of items ?? []) {
      const key = (item as { job_id: string }).job_id;
      (itemsByJobId[key] ??= []).push(item);
    }

    return NextResponse.json({ itemsByJobId });
  }

  const { data: items, error } = await supabase
    .from("job_line_items")
    .select("*")
    .eq("job_id", jobId as string)
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
