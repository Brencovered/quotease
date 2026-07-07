import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

/**
 * GET /api/jobs/list
 * -----------------
 * Returns jobs + quotes + board columns in one request.
 * Used by React Query hooks for client-side caching.
 * Cached for 2 minutes via stale-while-revalidate.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const [{ data: allJobs }, { data: listJobs }, { data: columns }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_number, client_name, site_address, total_cost, amount_paid, status, source, scheduled_date, scheduled_start, is_recurring_template, recurrence_rule")
      .eq("profile_id", businessId)
      .order("created_at", { ascending: false }),
    supabase
      .from("quotes")
      .select("*")
      .eq("profile_id", businessId)
      .eq("status", "accepted")
      .order("accepted_at", { ascending: true }),
    supabase
      .from("job_board_columns")
      .select("*")
      .eq("profile_id", businessId)
      .order("sort_order"),
  ]);

  const boardJobs = (allJobs ?? []).filter((j) => !j.is_recurring_template);

  return NextResponse.json(
    {
      jobs: boardJobs,
      listJobs: listJobs ?? [],
      columns: columns ?? [],
    },
    {
      headers: {
        "Cache-Control": "private, s-maxage=120, stale-while-revalidate=300",
      },
    }
  );
}
