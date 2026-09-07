/**
 * lib/abnDirectoryEnrichment.ts
 * --------------------------------
 * Phase 2: processes abn_trade_candidates (populated by
 * lib/abnBulkIngest.ts) in batches of 50, tries to find each
 * business's real website via free domain-guessing
 * (lib/domainGuesser.ts), and only creates a directory_listing when
 * a website is both found AND yields a confirmed suburb.
 *
 * The ABN Bulk Extract gives state + postcode, not suburb - and
 * directory_listing's trg_listing_has_real_identity trigger requires
 * a real suburb, not just a postcode placeholder. Rather than fake
 * one, this pulls the suburb from the verified website itself (reusing
 * extractJsonLdBusiness, already built for the main website scraper)
 * - if a website is found but no suburb can be confirmed from it, the
 * candidate is marked processed with the found URL recorded, but no
 * listing is created. That's a real, if small, gap this batch's
 * "found" count won't fully convert to "inserted" - visible in the
 * batch result rather than silently papered over.
 *
 * Candidates are processed in concurrent chunks, not one at a time.
 * Even after parallelizing the domain checks within a single lookup
 * (see lib/domainGuesser.ts - that fix alone cuts one business's
 * worst case from ~128s to ~8s), 50 candidates run fully sequentially
 * would still be up to ~400s worst case - too long for a serverless
 * function's execution limit. Chunking (10 concurrent at a time)
 * brings the same 50-candidate batch down to ~5 sequential rounds x
 * ~8s worst case, comfortably inside the 60s limit set on the route.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { findWebsiteByGuessing } from "@/lib/domainGuesser";
import { fetchWebsiteHtml, extractJsonLdBusiness } from "@/lib/websiteScraper";

const BATCH_SIZE = 50;
const CONCURRENCY = 10;

export interface AbnEnrichmentResult {
  processed: number;
  websitesFound: number;
  listingsCreated: number;
  remaining: number;
  detail: string[];
}

interface CandidateRow {
  id: string;
  legal_name: string;
  trading_name: string | null;
  matched_trade: string;
  state: string | null;
  postcode: string | null;
}

interface CandidateOutcome {
  websiteFound: boolean;
  listingCreated: boolean;
  detailLine: string;
}

async function processCandidate(candidate: CandidateRow, admin: ReturnType<typeof createAdminClient>): Promise<CandidateOutcome> {
  const displayName = candidate.trading_name || candidate.legal_name;

  const { url, candidatesTried } = await findWebsiteByGuessing(displayName);

  if (!url) {
    await admin.from("abn_trade_candidates").update({ processed_at: new Date().toISOString() }).eq("id", candidate.id);
    return { websiteFound: false, listingCreated: false, detailLine: `✗ ${displayName} - no verified match (${candidatesTried} tried)` };
  }

  // Confirm a real suburb before creating anything - see file header.
  let suburb: string | null = null;
  try {
    const html = await fetchWebsiteHtml(url);
    if (html) {
      const jsonLd = extractJsonLdBusiness(html);
      suburb = jsonLd?.addressLocality ?? null;
    }
  } catch {
    // leave suburb null - handled below same as "not found"
  }

  if (!suburb) {
    await admin.from("abn_trade_candidates").update({
      processed_at: new Date().toISOString(),
      website_url_found: url,
    }).eq("id", candidate.id);
    return { websiteFound: true, listingCreated: false, detailLine: `~ ${displayName} - found ${url} but no confirmed suburb, no listing created` };
  }

  // Dedupe against existing listings before inserting, same pattern
  // as the Yellow Pages scraper.
  const { data: existing } = await admin
    .from("directory_listing")
    .select("id")
    .ilike("business_name", displayName)
    .ilike("suburb", suburb)
    .limit(1);

  if (existing?.length) {
    await admin.from("abn_trade_candidates").update({
      processed_at: new Date().toISOString(),
      website_url_found: url,
      directory_listing_id: existing[0].id,
    }).eq("id", candidate.id);
    return { websiteFound: true, listingCreated: false, detailLine: `= ${displayName} - already listed` };
  }

  const { data: created, error } = await admin.from("directory_listing").insert({
    business_name: displayName,
    trades: [candidate.matched_trade],
    suburb,
    postcode: candidate.postcode,
    state: candidate.state,
    website_url: url,
    source: "abn_bulk_extract",
    is_claimed: false,
  }).select("id").single();

  if (error) {
    await admin.from("abn_trade_candidates").update({ processed_at: new Date().toISOString(), website_url_found: url }).eq("id", candidate.id);
    return { websiteFound: true, listingCreated: false, detailLine: `✗ ${displayName} - listing insert failed: ${error.message}` };
  }

  await admin.from("abn_trade_candidates").update({
    processed_at: new Date().toISOString(),
    website_url_found: url,
    directory_listing_id: created.id,
  }).eq("id", candidate.id);

  return { websiteFound: true, listingCreated: true, detailLine: `✓ ${displayName} - ${url} (${suburb})` };
}

export async function runAbnEnrichmentBatch(): Promise<AbnEnrichmentResult> {
  const admin = createAdminClient();

  const [{ data: candidates }, { count: remainingCount }] = await Promise.all([
    admin.from("abn_trade_candidates").select("*").is("processed_at", null).limit(BATCH_SIZE),
    admin.from("abn_trade_candidates").select("id", { count: "exact", head: true }).is("processed_at", null),
  ]);

  const result: AbnEnrichmentResult = {
    processed: 0,
    websitesFound: 0,
    listingsCreated: 0,
    remaining: Math.max(0, (remainingCount ?? 0) - BATCH_SIZE),
    detail: [],
  };

  const rows = (candidates ?? []) as CandidateRow[];
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(chunk.map(c => processCandidate(c, admin)));
    for (const outcome of outcomes) {
      result.processed++;
      if (outcome.websiteFound) result.websitesFound++;
      if (outcome.listingCreated) result.listingsCreated++;
      result.detail.push(outcome.detailLine);
    }
  }

  return result;
}
