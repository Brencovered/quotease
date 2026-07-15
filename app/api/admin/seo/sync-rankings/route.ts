import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { syncKeywordRankings } from "@/lib/seo/syncKeywordRankings";

export async function POST() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  try {
    const result = await syncKeywordRankings();
    return NextResponse.json(result);
  } catch (err) {
    // Most likely cause right now: GOOGLE_SERVICE_ACCOUNT_KEY isn't set up yet
    // (see lib/seo/searchConsole.ts for the manual setup steps required).
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
