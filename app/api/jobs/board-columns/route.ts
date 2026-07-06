import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import { getOrSeedBoardColumns } from "@/lib/jobBoard";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const businessId = await getActiveBusinessId(supabase, userData.user.id);
  const columns = await getOrSeedBoardColumns(supabase, businessId);
  return NextResponse.json({ columns });
}

export async function PUT(request: Request) {
  const { columns } = await request.json();
  if (!Array.isArray(columns)) {
    return NextResponse.json({ error: "columns must be an array" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  // Replace the whole board config atomically: delete existing columns for
  // this business, insert the new set with fresh sort order.
  await supabase.from("job_board_columns").delete().eq("profile_id", businessId);

  const rows = columns.map((c: { label: string; color: string; statuses: string[] }, i: number) => ({
    profile_id: businessId,
    label: c.label || "Untitled",
    color: c.color || "gray",
    statuses: c.statuses ?? [],
    sort_order: i,
  }));

  const { data, error } = await supabase.from("job_board_columns").insert(rows).select("*").order("sort_order");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, columns: data });
}
