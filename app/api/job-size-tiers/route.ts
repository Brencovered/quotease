import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface JobSizeTier {
  id: string;
  profile_id: string;
  name: string;
  max_days: number | null;
  markup_pct: number;
  sort_order: number;
  created_at: string;
}

const DEFAULT_TIERS: Omit<JobSizeTier, "id" | "profile_id" | "created_at">[] = [
  { name: "Small Job", max_days: 1, markup_pct: 10, sort_order: 0 },
  { name: "Medium Job", max_days: 3, markup_pct: 0, sort_order: 1 },
  { name: "Large Job", max_days: null, markup_pct: -5, sort_order: 2 },
];

/* ------------------------------------------------------------------ */
/*  GET - list job size tiers (auto-seed defaults if empty)            */
/* ------------------------------------------------------------------ */
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: tiersRaw, error } = await supabase
    .from("job_size_tiers")
    .select("*")
    .eq("profile_id", businessId)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let tiers = tiersRaw;

  /* Auto-seed defaults if user has no tiers yet */
  if (!tiers || tiers.length === 0) {
    const seeds = DEFAULT_TIERS.map((t, i) => ({
      profile_id: businessId,
      name: t.name,
      max_days: t.max_days,
      markup_pct: t.markup_pct,
      sort_order: i,
    }));

    const { data: seeded, error: seedError } = await supabase
      .from("job_size_tiers")
      .insert(seeds)
      .select()
      .order("sort_order", { ascending: true });

    if (seedError) {
      return NextResponse.json({ error: seedError.message }, { status: 500 });
    }
    tiers = seeded ?? [];
  }

  return NextResponse.json({ tiers: tiers ?? [] });
}

/* ------------------------------------------------------------------ */
/*  POST - create a job size tier                                      */
/* ------------------------------------------------------------------ */
export async function POST(request: Request) {
  const body = await request.json();
  const { name, markup_pct, max_days, sort_order } = body;

  if (!name || typeof markup_pct !== "number") {
    return NextResponse.json(
      { error: "Missing required fields: name, markup_pct" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: tier, error } = await supabase
    .from("job_size_tiers")
    .insert({
      profile_id: businessId,
      name: name.trim(),
      markup_pct,
      max_days: max_days ?? null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tier });
}

/* ------------------------------------------------------------------ */
/*  PATCH - update a job size tier                                     */
/* ------------------------------------------------------------------ */
export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, name, markup_pct, max_days, sort_order } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (markup_pct !== undefined) updateData.markup_pct = markup_pct;
  if (max_days !== undefined) updateData.max_days = max_days ?? null;
  if (sort_order !== undefined) updateData.sort_order = sort_order;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("job_size_tiers")
    .select("id")
    .eq("id", id)
    .eq("profile_id", businessId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }

  const { data: tier, error } = await supabase
    .from("job_size_tiers")
    .update(updateData)
    .eq("id", id)
    .eq("profile_id", businessId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tier });
}

/* ------------------------------------------------------------------ */
/*  DELETE - remove a job size tier                                    */
/* ------------------------------------------------------------------ */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: existing } = await supabase
    .from("job_size_tiers")
    .select("id")
    .eq("id", id)
    .eq("profile_id", businessId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("job_size_tiers")
    .delete()
    .eq("id", id)
    .eq("profile_id", businessId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
