import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { syncYesterdaysTraffic } from "@/lib/directoryTrafficSync";

/**
 * Manual trigger for the same sync the daily cron runs (see
 * app/api/cron/sync-directory-traffic) - lets an admin test the
 * PostHog integration today instead of waiting for the once-daily
 * schedule, using the exact same sync logic so there's no risk of the
 * manual and scheduled paths drifting apart.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const result = await syncYesterdaysTraffic();
  return NextResponse.json(result);
}
