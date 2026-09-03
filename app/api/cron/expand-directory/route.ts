/**
 * GET /api/cron/expand-directory
 * --------------------------------
 * Scheduled automation (see vercel.json) that grows the directory
 * without anyone manually picking a trade+suburb combo and clicking
 * "scrape" in the admin UI. Each run covers a small batch of combos
 * from the trade x location matrix (lib/tradeLocationMatrix.ts) -
 * never-covered ones first, then whichever are longest overdue for a
 * refresh - via lib/directoryExpansionSweep.ts, which also handles not
 * re-hitting the same combo before it's actually due again.
 *
 * Scheduled once daily (matching every other cron in this project -
 * none currently run more than once a day) at 6 combos/run. At 360
 * total combos (15 trades x 24 locations), that's a full first sweep
 * in about 60 days on the cron alone, then it naturally settles into
 * refreshing whatever combo is most overdue rather than re-covering
 * everything constantly. The admin UI also exposes a manual "run next
 * batch now" trigger for faster coverage without waiting on the
 * schedule.
 *
 * AUTH: protected by CRON_SECRET, same pattern as the other cron routes.
 */

import { NextResponse } from "next/server";
import { runDirectoryExpansionSweep } from "@/lib/directoryExpansionSweep";

export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[expand-directory] CRON_SECRET is not set - rejecting all requests, including Vercel's own cron trigger.");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDirectoryExpansionSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Directory expansion sweep failed" },
      { status: 500 }
    );
  }
}
