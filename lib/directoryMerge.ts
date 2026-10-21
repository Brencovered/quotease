/**
 * Plans duplicate merges for directory_listing.
 *
 * A global unique phone or domain would delete legitimate multi-suburb
 * service-area pages (one brand, one phone, many suburbs). Groups are
 * therefore per suburb.
 *
 * Auto-merge only when the names are the same business. Different
 * businesses that share a phone or domain in one suburb are kept, and
 * the extra rows drop the normalised key (phone_identity_shared /
 * domain_identity_shared) so a unique index can still be created.
 * Two claimed profiles in one group are left untouched for a human.
 */

import { isSharedAuServiceNumber, normalizeSuburbKey } from "@/lib/directoryIdentity";

export interface MergeCandidate {
  id: string;
  business_name: string;
  suburb: string | null;
  phone_e164: string | null;
  website_domain: string | null;
  abn: string | null;
  is_claimed: boolean;
  profile_id: string | null;
  created_at: string;
  score: number;
}

export interface MergeAction {
  winnerId: string;
  loserIds: string[];
  reason: string;
}

export interface SuppressAction {
  keepId: string;
  suppressIds: string[];
  field: "phone" | "domain";
  reason: string;
}

export interface ReviewAction {
  ids: string[];
  reason: string;
}

export interface DirectoryMergePlan {
  merges: MergeAction[];
  suppressions: SuppressAction[];
  needsReview: ReviewAction[];
}

export function significantBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\b(pty|ltd|limited|proprietary|inc|incorporated|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TRADE_TOKENS = new Set([
  "electrical", "electrician", "plumbing", "plumber", "carpentry", "carpenter",
  "roofing", "roofer", "painting", "painter", "concreting", "concrete", "concreter",
  "landscaping", "landscape", "plaster", "plastering", "plasterer", "fencing",
  "heating", "cooling", "handyman", "tiling", "tiler",
]);

function tokenFold(token: string): string {
  return token.replace(/ing$/, "").replace(/ers$/, "").replace(/er$/, "").replace(/e$/, "");
}

function tokenClose(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length >= 5 && longer.startsWith(shorter)) return true;
  const foldedA = tokenFold(a);
  const foldedB = tokenFold(b);
  return foldedA.length >= 5 && foldedA === foldedB;
}

export function namesCompatible(a: string, b: string): boolean {
  const left = significantBusinessName(a);
  const right = significantBusinessName(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const leftTokens = left.split(" ").filter((word) => word.length > 2);
  const rightTokens = right.split(" ").filter((word) => word.length > 2);
  if (leftTokens.length === 0 || rightTokens.length === 0) return false;

  const leftTrades = leftTokens.filter((token) => TRADE_TOKENS.has(token));
  const rightTrades = rightTokens.filter((token) => TRADE_TOKENS.has(token));
  if (leftTrades.length > 0 && rightTrades.length > 0) {
    const tradesAgree = leftTrades.some((token) => rightTrades.some((other) => tokenClose(token, other)));
    if (!tradesAgree) return false;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.some((other) => tokenClose(token, other))) overlap += 1;
  }
  const smaller = Math.min(leftTokens.length, rightTokens.length);
  return overlap / smaller >= 0.8;
}

export function listingRichness(row: {
  is_claimed?: boolean | null;
  profile_id?: string | null;
  private_email?: string | null;
  scraped_contact_email?: string | null;
  website_url?: string | null;
  contact_phone?: string | null;
  scraped_contact_phone?: string | null;
  abn?: string | null;
  blurb?: string | null;
  logo_url?: string | null;
  google_reviews_count?: number | null;
  trades?: string[] | null;
  services_offered?: string[] | null;
}): number {
  let score = 0;
  if (row.is_claimed) score += 1000;
  if (row.profile_id) score += 500;
  if (row.private_email) score += 80;
  if (row.scraped_contact_email) score += 80;
  if (row.website_url) score += 40;
  if (row.contact_phone || row.scraped_contact_phone) score += 20;
  if (row.abn) score += 40;
  if (row.blurb) score += 15;
  if (row.logo_url) score += 10;
  if (row.google_reviews_count) score += Math.min(row.google_reviews_count, 50);
  if (row.trades?.length) score += row.trades.length;
  if (row.services_offered?.length) score += 5;
  return score;
}

function preferWinner(rows: MergeCandidate[]): MergeCandidate {
  return [...rows].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.is_claimed !== b.is_claimed) return a.is_claimed ? -1 : 1;
    const created = a.created_at.localeCompare(b.created_at);
    if (created !== 0) return created;
    return a.id.localeCompare(b.id);
  })[0];
}

class UnionFind {
  private parent = new Map<string, string>();

  add(id: string) {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    const parent = this.parent.get(id);
    if (!parent || parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }
}

function componentNamesCompatible(rows: MergeCandidate[]): boolean {
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (!namesCompatible(rows[i].business_name, rows[j].business_name)) return false;
    }
  }
  return true;
}

function claimedProfileIds(rows: MergeCandidate[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.is_claimed && row.profile_id) ids.add(row.profile_id);
  }
  return [...ids];
}

export function planDirectoryMerges(rows: MergeCandidate[]): DirectoryMergePlan {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const uf = new UnionFind();
  for (const row of rows) uf.add(row.id);

  const buckets = new Map<string, string[]>();
  function addToBucket(key: string, id: string) {
    const list = buckets.get(key);
    if (list) list.push(id);
    else buckets.set(key, [id]);
  }

  for (const row of rows) {
    const suburb = normalizeSuburbKey(row.suburb);
    if (!suburb) continue;
    const nameKey = significantBusinessName(row.business_name);
    if (nameKey) addToBucket(`name:${suburb}:${nameKey}`, row.id);
    if (row.abn) addToBucket(`abn:${suburb}:${row.abn}`, row.id);
    if (row.phone_e164 && !isSharedAuServiceNumber(row.phone_e164)) {
      addToBucket(`phone:${suburb}:${row.phone_e164}`, row.id);
    }
    if (row.website_domain) addToBucket(`domain:${suburb}:${row.website_domain}`, row.id);
  }

  for (const [key, ids] of buckets) {
    const unique = [...new Set(ids)];
    if (unique.length < 2) continue;
    const kind = key.slice(0, key.indexOf(":"));
    for (let i = 1; i < unique.length; i++) {
      const left = byId.get(unique[0]);
      const right = byId.get(unique[i]);
      if (!left || !right) continue;
      // Same ABN or same normalised name in one suburb is the same listing.
      // Phone and domain links still require the names to agree, so an
      // electrician and a plumber who share a switchboard stay apart.
      if (kind === "phone" || kind === "domain") {
        if (!namesCompatible(left.business_name, right.business_name)) continue;
      }
      uf.union(unique[0], unique[i]);
    }
  }

  const groups = new Map<string, MergeCandidate[]>();
  for (const row of rows) {
    const root = uf.find(row.id);
    const list = groups.get(root);
    if (list) list.push(row);
    else groups.set(root, [row]);
  }

  const plan: DirectoryMergePlan = { merges: [], suppressions: [], needsReview: [] };
  const reviewed = new Set<string>();

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const profiles = claimedProfileIds(group);
    if (profiles.length > 1) {
      plan.needsReview.push({
        ids: group.map((row) => row.id),
        reason: "multiple claimed profiles share an identity in one suburb",
      });
      for (const row of group) reviewed.add(row.id);
      continue;
    }

    if (componentNamesCompatible(group)) {
      const winner = preferWinner(group);
      plan.merges.push({
        winnerId: winner.id,
        loserIds: group.filter((row) => row.id !== winner.id).map((row) => row.id),
        reason: "same business in one suburb",
      });
    }
  }

  // Phone and domain buckets that were not unioned are different businesses
  // sharing a key. Two claimed profiles stay for a person. Everyone else
  // keeps the row and drops the normalised key on the poorer copies.
  const reviewSeen = new Set<string>();
  function addReview(ids: string[], reason: string) {
    const key = [...ids].sort().join(",");
    if (reviewSeen.has(key)) return;
    reviewSeen.add(key);
    for (const id of ids) reviewed.add(id);
    plan.needsReview.push({ ids, reason });
  }

  function componentsOf(ids: string[]): MergeCandidate[][] {
    const grouped = new Map<string, MergeCandidate[]>();
    for (const id of ids) {
      const row = byId.get(id);
      if (!row || reviewed.has(id)) continue;
      const root = uf.find(id);
      const list = grouped.get(root);
      if (list) list.push(row);
      else grouped.set(root, [row]);
    }
    return [...grouped.values()];
  }

  function shareKey(ids: string[], field: "phone" | "domain") {
    const parts = componentsOf([...new Set(ids)]);
    if (parts.length < 2) return;
    const claimedParts = parts.filter((part) => claimedProfileIds(part).length > 0);
    if (claimedParts.length > 1) {
      addReview(
        claimedParts.flat().map((row) => row.id),
        `multiple claimed profiles share a ${field} in one suburb`,
      );
      return;
    }
    const ranked = parts
      .map((part) => ({ part, winner: preferWinner(part) }))
      .sort((a, b) => b.winner.score - a.winner.score || a.winner.created_at.localeCompare(b.winner.created_at) || a.winner.id.localeCompare(b.winner.id));
    const keep = ranked[0].winner;
    const suppressIds = ranked.slice(1).flatMap((entry) => entry.part.map((row) => row.id));
    if (suppressIds.length === 0) return;
    plan.suppressions.push({
      keepId: keep.id,
      suppressIds,
      field,
      reason: `different businesses share a ${field} in one suburb`,
    });
  }

  for (const [key, ids] of buckets) {
    const kind = key.slice(0, key.indexOf(":"));
    if (kind === "phone") shareKey(ids, "phone");
    else if (kind === "domain") shareKey(ids, "domain");
  }

  return plan;
}

const TEXT_FIELDS = [
  "website_url",
  "suburb",
  "postcode",
  "scraped_contact_email",
  "scraped_contact_phone",
  "private_email",
  "contact_phone",
  "blurb",
  "logo_url",
  "place_id",
  "street_address",
  "instagram_url",
  "facebook_url",
  "abn",
  "phone_e164",
  "website_domain",
  "claim_pending_profile_id",
] as const;

export interface ListingFieldBag {
  business_name?: string | null;
  trades?: string[] | null;
  photo_references?: string[] | null;
  services_offered?: string[] | null;
  google_rating?: number | null;
  google_reviews_count?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  years_experience?: number | null;
  profile_id?: string | null;
  is_claimed?: boolean | null;
  [key: string]: unknown;
}

/** Copy empty winner fields from the loser. Never blank out a value the winner already has. */
export function mergeListingFields(winner: ListingFieldBag, loser: ListingFieldBag): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of TEXT_FIELDS) {
    const current = winner[field];
    const incoming = loser[field];
    if ((current == null || current === "") && incoming != null && incoming !== "") {
      patch[field] = incoming;
    }
  }
  if (winner.google_rating == null && loser.google_rating != null) patch.google_rating = loser.google_rating;
  if (winner.google_reviews_count == null && loser.google_reviews_count != null) {
    patch.google_reviews_count = loser.google_reviews_count;
  }
  if (winner.latitude == null && loser.latitude != null) patch.latitude = loser.latitude;
  if (winner.longitude == null && loser.longitude != null) patch.longitude = loser.longitude;
  if (winner.years_experience == null && loser.years_experience != null) patch.years_experience = loser.years_experience;
  if (!winner.profile_id && loser.profile_id) patch.profile_id = loser.profile_id;
  if (!winner.is_claimed && loser.is_claimed) patch.is_claimed = true;

  const trades = [...new Set([...(winner.trades ?? []), ...(loser.trades ?? [])].filter(Boolean))];
  if (trades.length > (winner.trades?.length ?? 0)) patch.trades = trades;
  const photos = [...new Set([...(winner.photo_references ?? []), ...(loser.photo_references ?? [])])].slice(0, 12);
  if (photos.length > (winner.photo_references?.length ?? 0)) patch.photo_references = photos;
  const services = [...new Set([...(winner.services_offered ?? []), ...(loser.services_offered ?? [])])].slice(0, 24);
  if (services.length > (winner.services_offered?.length ?? 0)) patch.services_offered = services;

  return patch;
}
