import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { runSeoRefresh } from "@/lib/seo/refreshSeo";

/**
 * Same logic as the weekly cron (app/api/cron/refresh-seo), triggered on
 * demand by a logged-in admin instead of waiting for the schedule --
 * neither of us has the CRON_SECRET to hand to invoke that route directly,
 * and waiting until the next scheduled run isn't useful when you want to
 * see a fix (e.g. real per-listing state instead of everything defaulting
 * to "vic") reflected in trade_suburb_pages right now.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const result = await runSeoRefresh();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
