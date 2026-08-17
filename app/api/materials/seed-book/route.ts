import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import { normalizeTradeValue } from "@/lib/genericTrades";
import { seedTradeBook } from "@/lib/tradeMaterialSeed";

/**
 * Backfill starter materials + package for each trade on the business
 * profile. Safe to call repeatedly — seed helpers no-op when data exists.
 * Used by the materials book so accounts that onboarded before generic
 * trade seeding still get a usable book.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("trades")
    .eq("id", businessId)
    .single();

  const rawTrades = Array.isArray(profile?.trades) ? profile.trades : [];
  const trades = Array.from(
    new Set(
      rawTrades
        .map((t) => normalizeTradeValue(typeof t === "string" ? t : null))
        .filter((t): t is string => !!t)
    )
  );

  if (!trades.length) {
    return NextResponse.json({ ok: true, seeded: [] });
  }

  for (const trade of trades) {
    await seedTradeBook(supabase, businessId, trade);
  }

  return NextResponse.json({ ok: true, seeded: trades });
}
