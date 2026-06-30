/**
 * GET /api/admin/stats
 * --------------------
 * Returns directory listing statistics for the admin dashboard.
 * Admin only.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

export async function GET() {
  // Auth check
  const authClient = await createClient();
  const { data: userData } = await authClient.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Total tradies
  const { count: total } = await admin
    .from("directory_listing")
    .select("*", { count: "exact", head: true });

  // With email (private_email)
  const { count: withEmail } = await admin
    .from("directory_listing")
    .select("*", { count: "exact", head: true })
    .not("private_email", "is", null);

  // With phone
  const { count: withPhone } = await admin
    .from("directory_listing")
    .select("*", { count: "exact", head: true })
    .not("scraped_contact_phone", "is", null);

  // With ratings
  const { count: withRating } = await admin
    .from("directory_listing")
    .select("*", { count: "exact", head: true })
    .not("google_rating", "is", null);

  // With photos
  const { count: withPhotos } = await admin
    .from("directory_listing")
    .select("*", { count: "exact", head: true })
    .not("photo_references", "is", null)
    .gt("photo_references", "{}");

  // With logo
  const { count: withLogo } = await admin
    .from("directory_listing")
    .select("*", { count: "exact", head: true })
    .not("logo_url", "is", null);

  // By trade breakdown
  const { data: byTrade } = await admin
    .from("directory_listing")
    .select("trades");

  const tradeCounts: Record<string, number> = {};
  for (const row of byTrade ?? []) {
    for (const t of (row.trades ?? []) as string[]) {
      tradeCounts[t] = (tradeCounts[t] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    total: total ?? 0,
    withEmail: withEmail ?? 0,
    withPhone: withPhone ?? 0,
    withRating: withRating ?? 0,
    withPhotos: withPhotos ?? 0,
    withLogo: withLogo ?? 0,
    byTrade: tradeCounts,
  });
}
