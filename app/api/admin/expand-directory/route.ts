import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDirectoryExpansionSweep, scrapeCustomCombo } from "@/lib/directoryExpansionSweep";
import { TRADES, LOCATIONS } from "@/lib/tradeLocationMatrix";

/**
 * Manual trigger for the same sweep the daily cron runs (see
 * app/api/cron/expand-directory) - lets an admin run extra batches
 * on demand rather than waiting on the once-a-day schedule, using the
 * exact same coverage-tracking logic so a manual run and a cron run
 * never duplicate each other's work.
 *
 * Optionally accepts { trade, suburb, postcode, pages } to scrape one
 * specific combo instead of letting the sweep pick automatically -
 * still recorded in the same coverage table (see
 * lib/directoryExpansionSweep.ts scrapeCustomCombo), so a manually
 * targeted trade/suburb doesn't get redundantly re-picked by a later
 * automatic run.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const trade = typeof body.trade === "string" ? body.trade.trim() : "";
  const suburb = typeof body.suburb === "string" ? body.suburb.trim() : "";

  if (trade && suburb) {
    const postcode = typeof body.postcode === "string" ? body.postcode.trim() : "";
    const pages = typeof body.pages === "number" ? body.pages : 3;
    const admin = createAdminClient();
    const result = await scrapeCustomCombo(trade, suburb, postcode, pages, admin);
    return NextResponse.json(result);
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
