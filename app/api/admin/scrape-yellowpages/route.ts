import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { scrapeYellowPagesCombo } from "@/lib/yellowPagesScraper";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { trade = "electrician", suburb = "Sydney NSW", postcode = "", pages = 2 } = body;

  const admin = createAdminClient();
  const result = await scrapeYellowPagesCombo(trade, suburb, postcode, pages, admin);

  return NextResponse.json(result);
}
