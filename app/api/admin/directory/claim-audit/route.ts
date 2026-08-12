/**
 * GET /api/admin/directory/claim-audit
 * ------------------------------------
 * Surfaces the claim and signup forensics so they can actually be read.
 *
 * Storing IPs is only half the job; four suspicious signups could not be
 * investigated because nothing recorded them, and a column nobody queries is
 * the same dead end one step later. This is the query.
 *
 * What it looks for, in rough order of how much each would worry me:
 *
 *  - Unverified claims on scraped listings. A business that was imported from
 *    Google never signed up and has no idea the page exists, so a competitor
 *    taking it over is invisible to them. This is the abuse the outreach
 *    campaign makes possible.
 *  - Shared IPs across accounts. One person running several "businesses" is
 *    the clearest signal available, and it is the thing the missing audit log
 *    would have shown.
 *  - Disputed attempts, ie someone trying to claim an already-claimed
 *    listing. Usually innocent, occasionally not.
 *
 * Deliberately reports rather than blocks. Australian trades legitimately run
 * a Gmail while their website shows an address on their own domain, so an
 * email mismatch is evidence to weigh, never grounds to refuse a claim
 * automatically. A false positive here means telling a real tradie he is a
 * fraud, which is worse than a missed one.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: attempts, error } = await admin
    .from("directory_claim_attempts")
    .select(
      "id, attempted_business_name, suburb, trade, outcome, ip_address, user_agent, verified_via_email, attempted_by_profile_id, matched_listing_id, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = attempts ?? [];

  // Accounts sharing an IP. The single most useful signal, and the one the
  // pruned Supabase audit log could not give.
  const byIp = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.ip_address || !r.attempted_by_profile_id) continue;
    const set = byIp.get(r.ip_address) ?? new Set<string>();
    set.add(r.attempted_by_profile_id);
    byIp.set(r.ip_address, set);
  }
  const sharedIps = [...byIp.entries()]
    .filter(([, profiles]) => profiles.size > 1)
    .map(([ip, profiles]) => ({ ip, accountCount: profiles.size, profileIds: [...profiles] }))
    .sort((a, b) => b.accountCount - a.accountCount);

  const claimedScraped = rows.filter((r) => r.outcome === "claimed");

  return NextResponse.json({
    summary: {
      totalAttempts: rows.length,
      claimedExistingListing: claimedScraped.length,
      // The number that matters: took over an imported listing without
      // proving control of the address that listing already carried.
      claimedButUnverified: claimedScraped.filter((r) => !r.verified_via_email).length,
      createdNew: rows.filter((r) => r.outcome === "created_new").length,
      disputed: rows.filter((r) => r.outcome === "disputed").length,
      missingIp: rows.filter((r) => !r.ip_address).length,
    },
    // Pre-dates the forensics columns and cannot be backfilled: no record of
    // those requests exists anywhere.
    note:
      "Rows created before the forensics migration have a null ip_address. Supabase's auth.audit_log_entries is pruned and was empty, so historical IPs cannot be recovered.",
    sharedIps,
    unverifiedClaims: claimedScraped
      .filter((r) => !r.verified_via_email)
      .map((r) => ({
        business: r.attempted_business_name,
        suburb: r.suburb,
        listingId: r.matched_listing_id,
        profileId: r.attempted_by_profile_id,
        ip: r.ip_address,
        at: r.created_at,
      })),
    disputed: rows
      .filter((r) => r.outcome === "disputed")
      .map((r) => ({
        business: r.attempted_business_name,
        listingId: r.matched_listing_id,
        profileId: r.attempted_by_profile_id,
        ip: r.ip_address,
        at: r.created_at,
      })),
    recent: rows.slice(0, 50),
  });
}
