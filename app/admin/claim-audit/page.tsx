import { createAdminClient } from "@/lib/supabase/admin";
import ClaimAuditPanel from "@/components/admin/ClaimAuditPanel";

export const dynamic = "force-dynamic";

/**
 * The verification logic itself (IP logging, IP blocklist checks, email-
 * ownership matching on claims, suburb sanity checks, per-IP rate limiting
 * on new listing creation) already existed in app/api/directory/claim -
 * built directly in response to the 103.78.46.30 incident referenced in
 * that route's own comments. What was missing was anywhere to actually
 * see the forensics it was already collecting: /api/admin/directory/
 * claim-audit existed as a working JSON endpoint with zero UI consuming
 * it. This page is that missing piece, not a new detection mechanism.
 *
 * Reuses the same query/aggregation shape as that API route directly
 * (rather than this page fetching its own API route internally) - kept
 * that route untouched rather than risk changing something already
 * working to share the logic.
 */
export default async function ClaimAuditPage() {
  const admin = createAdminClient();

  const { data: attemptRows } = await admin
    .from("directory_claim_attempts")
    .select(
      "id, attempted_business_name, suburb, trade, outcome, ip_address, user_agent, verified_via_email, attempted_by_profile_id, matched_listing_id, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = attemptRows ?? [];

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

  const { data: blocklistRows } = await admin
    .from("ip_blocklist")
    .select("ip_address, reason, blocked_by, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-[1.8rem] text-[var(--ink)]">Claim & signup verification</h1>
        <p className="text-[13.5px] text-[var(--ink-faint)] mt-1">
          Forensics for directory claims and account creation - reports, doesn&apos;t block automatically
        </p>
      </div>
      <ClaimAuditPanel
        summary={{
          totalAttempts: rows.length,
          claimedExistingListing: claimedScraped.length,
          claimedButUnverified: claimedScraped.filter((r) => !r.verified_via_email).length,
          createdNew: rows.filter((r) => r.outcome === "created_new").length,
          disputed: rows.filter((r) => r.outcome === "disputed").length,
          missingIp: rows.filter((r) => !r.ip_address).length,
        }}
        sharedIps={sharedIps}
        unverifiedClaims={claimedScraped
          .filter((r) => !r.verified_via_email)
          .map((r) => ({
            business: r.attempted_business_name,
            suburb: r.suburb,
            listingId: r.matched_listing_id,
            profileId: r.attempted_by_profile_id,
            ip: r.ip_address,
            at: r.created_at,
          }))}
        disputed={rows
          .filter((r) => r.outcome === "disputed")
          .map((r) => ({
            business: r.attempted_business_name,
            listingId: r.matched_listing_id,
            profileId: r.attempted_by_profile_id,
            ip: r.ip_address,
            at: r.created_at,
          }))}
        recent={rows.slice(0, 50)}
        blocklist={blocklistRows ?? []}
      />
    </div>
  );
}
