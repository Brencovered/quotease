import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDirectoryExpansionSweep } from "@/lib/directoryExpansionSweep";
import { TRADES, LOCATIONS } from "@/lib/tradeLocationMatrix";

/**
 * Manual trigger for the same sweep the daily cron runs (see
 * app/api/cron/expand-directory) - lets an admin run extra batches
 * on demand rather than waiting on the once-a-day schedule, using the
 * exact same coverage-tracking logic so a manual run and a cron run
 * never duplicate each other's work.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const result = await runDirectoryExpansionSweep();
  return NextResponse.json(result);
}

/**
 * Coverage stats for the admin UI - how much of the trade x location
 * matrix has ever been scraped at least once, so progress is visible
 * without needing to run a batch first.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const matrixSize = TRADES.length * LOCATIONS.length;

  const { count: coveredCount } = await admin
    .from("directory_scrape_coverage")
    .select("trade", { count: "exact", head: true });

  return NextResponse.json({
    matrixSize,
    covered: coveredCount ?? 0,
  });
}
