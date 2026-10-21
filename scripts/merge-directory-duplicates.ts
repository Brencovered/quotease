/**
 * Review and apply directory_listing duplicate merges.
 *
 * Dry-run is the default. It prints the plan and writes nothing.
 *
 *   npx tsx scripts/merge-directory-duplicates.ts
 *   npx tsx scripts/merge-directory-duplicates.ts --apply
 *
 * --apply merges rows that are the same business in the same suburb
 * (claimed or richer row wins; the other row is snapshotted into
 * directory_listing_merge_log, foreign keys are repointed, then it is
 * deleted). Different businesses that share a phone or domain in one
 * suburb are kept. The extra rows drop the normalised key
 * (phone_identity_shared / domain_identity_shared) so the visible phone
 * and website stay, and the unique indexes can be created.
 *
 * A group with two claimed profiles is printed and left alone.
 *
 * Requires migration 20261021120000 (the normalised columns) and:
 *   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Do not point this at production until you have read the dry-run.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  listingRichness,
  mergeListingFields,
  planDirectoryMerges,
  type ListingFieldBag,
  type MergeCandidate,
} from "@/lib/directoryMerge";
import { isSharedAuServiceNumber, normalizeAuPhone, normalizeWebsiteDomain } from "@/lib/directoryIdentity";

const PAGE = 1000;

function requireEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
}

async function loadAll() {
  const admin = createAdminClient();
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from("directory_listing")
      .select("*")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  return { admin, rows };
}

function toCandidate(row: Record<string, unknown>): MergeCandidate {
  const phone = isSharedAuServiceNumber(normalizeAuPhone(row.contact_phone as string) ?? "")
    ? null
    : (normalizeAuPhone(row.contact_phone as string) ?? normalizeAuPhone(row.scraped_contact_phone as string));
  const sharedPhone = phone != null && isSharedAuServiceNumber(phone);
  return {
    id: String(row.id),
    business_name: String(row.business_name ?? ""),
    suburb: (row.suburb as string | null) ?? null,
    phone_e164: row.phone_identity_shared || sharedPhone ? null : (phone ?? (row.phone_e164 as string | null) ?? null),
    website_domain: row.domain_identity_shared ? null : (normalizeWebsiteDomain(row.website_url as string) ?? (row.website_domain as string | null) ?? null),
    abn: (row.abn as string | null) ?? null,
    is_claimed: Boolean(row.is_claimed),
    profile_id: (row.profile_id as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    score: listingRichness({
      is_claimed: Boolean(row.is_claimed),
      profile_id: (row.profile_id as string | null) ?? null,
      private_email: (row.private_email as string | null) ?? null,
      scraped_contact_email: (row.scraped_contact_email as string | null) ?? null,
      website_url: (row.website_url as string | null) ?? null,
      contact_phone: (row.contact_phone as string | null) ?? null,
      scraped_contact_phone: (row.scraped_contact_phone as string | null) ?? null,
      abn: (row.abn as string | null) ?? null,
      blurb: (row.blurb as string | null) ?? null,
      logo_url: (row.logo_url as string | null) ?? null,
      google_reviews_count: (row.google_reviews_count as number | null) ?? null,
      trades: (row.trades as string[] | null) ?? null,
      services_offered: (row.services_offered as string[] | null) ?? null,
    }),
  };
}

async function repoint(admin: ReturnType<typeof createAdminClient>, loserId: string, winnerId: string) {
  const updates = [
    admin.from("directory_claim_attempts").update({ matched_listing_id: winnerId }).eq("matched_listing_id", loserId),
    admin.from("directory_removal_requests").update({ listing_id: winnerId }).eq("listing_id", loserId),
    admin.from("abn_trade_candidates").update({ directory_listing_id: winnerId }).eq("directory_listing_id", loserId),
    admin.from("directory_enquiries").update({ listing_id: winnerId }).eq("listing_id", loserId),
  ];
  for (const query of updates) {
    const { error } = await query;
    if (error) console.error(`[merge] repoint ${loserId} -> ${winnerId} failed:`, error.message);
  }

  const { data: days, error } = await admin
    .from("directory_listing_traffic_daily")
    .select("day, pageviews, cta_clicks")
    .eq("listing_id", loserId);
  if (error) {
    console.error("[merge] traffic read failed:", error.message);
    return;
  }
  for (const day of days ?? []) {
    const { data: existing } = await admin
      .from("directory_listing_traffic_daily")
      .select("pageviews, cta_clicks")
      .eq("listing_id", winnerId)
      .eq("day", day.day)
      .maybeSingle();
    if (existing) {
      await admin.from("directory_listing_traffic_daily").update({
        pageviews: (existing.pageviews ?? 0) + (day.pageviews ?? 0),
        cta_clicks: (existing.cta_clicks ?? 0) + (day.cta_clicks ?? 0),
      }).eq("listing_id", winnerId).eq("day", day.day);
      await admin.from("directory_listing_traffic_daily").delete().eq("listing_id", loserId).eq("day", day.day);
    } else {
      await admin.from("directory_listing_traffic_daily").update({ listing_id: winnerId }).eq("listing_id", loserId).eq("day", day.day);
    }
  }
}

async function main() {
  requireEnv();
  const apply = process.argv.includes("--apply");
  const { admin, rows } = await loadAll();
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const plan = planDirectoryMerges(rows.map(toCandidate));

  console.log(`listings: ${rows.length}`);
  console.log(`merges: ${plan.merges.length} groups, ${plan.merges.reduce((sum, group) => sum + group.loserIds.length, 0)} rows would be folded in`);
  console.log(`suppressions: ${plan.suppressions.length} shared-key groups`);
  console.log(`needs review (not changed): ${plan.needsReview.length}`);

  for (const group of plan.merges) {
    const winner = byId.get(group.winnerId);
    const losers = group.loserIds.map((id) => byId.get(id)?.business_name ?? id).join(" | ");
    console.log(`MERGE keep ${winner?.business_name} (${winner?.suburb}) <- ${losers}`);
  }
  for (const group of plan.suppressions) {
    console.log(`SUPPRESS ${group.field} keep ${group.keepId} drop key on ${group.suppressIds.join(", ")} — ${group.reason}`);
  }
  for (const group of plan.needsReview) {
    const names = group.ids.map((id) => `${byId.get(id)?.business_name} (${byId.get(id)?.suburb})`).join(" | ");
    console.log(`REVIEW ${names} — ${group.reason}`);
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write. Apply the unique-index migration after that.");
    return;
  }

  for (const group of plan.merges) {
    const winner = byId.get(group.winnerId);
    if (!winner) continue;
    let current = { ...winner };
    for (const loserId of group.loserIds) {
      const loser = byId.get(loserId);
      if (!loser) continue;
      const patch = mergeListingFields(current as ListingFieldBag, loser as ListingFieldBag);
      patch.updated_at = new Date().toISOString();
      const { error: logError } = await admin.from("directory_listing_merge_log").insert({
        winner_id: group.winnerId,
        loser_id: loserId,
        match_reason: group.reason,
        loser_snapshot: loser,
      });
      if (logError) {
        console.error(`[merge] snapshot failed for ${loserId}, skipping delete:`, logError.message);
        continue;
      }
      if (Object.keys(patch).length > 0) {
        const { error } = await admin.from("directory_listing").update(patch).eq("id", group.winnerId);
        if (error) {
          console.error(`[merge] winner update failed for ${group.winnerId}:`, error.message);
          continue;
        }
        current = { ...current, ...patch };
      }
      await repoint(admin, loserId, group.winnerId);
      const { error: deleteError } = await admin.from("directory_listing").delete().eq("id", loserId);
      if (deleteError) console.error(`[merge] delete ${loserId} failed:`, deleteError.message);
      else console.log(`deleted ${loserId}`);
    }
  }

  for (const group of plan.suppressions) {
    const column = group.field === "phone" ? "phone_identity_shared" : "domain_identity_shared";
    const { error } = await admin
      .from("directory_listing")
      .update({ [column]: true, updated_at: new Date().toISOString() })
      .in("id", group.suppressIds);
    if (error) console.error(`[merge] suppress ${group.field} failed:`, error.message);
    else console.log(`suppressed ${group.field} on ${group.suppressIds.length} row(s)`);
  }

  console.log("Apply finished. Review the NEEDS REVIEW lines, then run the unique-index migration.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
