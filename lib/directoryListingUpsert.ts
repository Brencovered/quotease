/**
 * Insert-or-update a directory_listing on the normalised identity keys.
 *
 * Postgres can name only one ON CONFLICT target, and a listing can collide
 * on place id, ABN, phone, or domain independently. This looks those up
 * in order and updates the row it finds. A unique-index violation from a
 * race falls through to the same update.
 *
 * strategy "insert" (claim, self-signup) does not attach the new row to
 * a different business. A unique collision is returned as a conflict.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSharedAuServiceNumber,
  listingPhoneE164,
  mergeDirectorySource,
  normalizeAbn,
  normalizeAuPhone,
  normalizeWebsiteDomain,
} from "@/lib/directoryIdentity";
import { namesCompatible } from "@/lib/directoryMerge";

const MATCH_COLUMNS = [
  "id", "business_name", "suburb", "trades", "website_url", "website_domain",
  "phone_e164", "scraped_contact_phone", "contact_phone", "scraped_contact_email",
  "private_email", "abn", "is_claimed", "profile_id", "source", "place_id",
  "blurb", "logo_url", "google_rating", "google_reviews_count", "photo_references",
  "latitude", "longitude", "street_address", "facebook_url", "instagram_url",
  "years_experience", "services_offered", "licenses", "testimonials",
  "services_extraction_method", "phone_identity_shared", "domain_identity_shared",
  "claim_pending_profile_id",
].join(", ");

export interface DirectoryListingInput {
  business_name: string;
  trades?: string[] | null;
  website_url?: string | null;
  suburb?: string | null;
  postcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  place_id?: string | null;
  google_rating?: number | null;
  google_reviews_count?: number | null;
  photo_references?: string[] | null;
  scraped_contact_phone?: string | null;
  contact_phone?: string | null;
  scraped_contact_email?: string | null;
  private_email?: string | null;
  logo_url?: string | null;
  blurb?: string | null;
  source: string;
  is_claimed?: boolean;
  profile_id?: string | null;
  abn?: string | null;
  street_address?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  years_experience?: number | null;
  licenses?: unknown;
  services_offered?: string[] | null;
  services_extraction_method?: "structural" | "keyword" | null;
  testimonials?: unknown;
  claim_pending_profile_id?: string | null;
  phone_identity_shared?: boolean;
  domain_identity_shared?: boolean;
}

export interface UpsertDirectoryOptions {
  strategy?: "identity" | "insert";
  /** Overwrite Google rating, reviews, photos, and coordinates when the incoming value is present. */
  refresh?: boolean;
  /** Write incoming non-null fields over the existing row. Used when an admin has reviewed the values. */
  overwrite?: boolean;
}

export interface UpsertDirectoryResult {
  id: string | null;
  action: "inserted" | "updated" | "conflict";
  conflict?: string;
}

type ListingRow = Record<string, unknown> & { id: string; business_name?: string | null; source?: string | null };

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}

function blank(value: unknown): boolean {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

// supabase-js filter builders are generic; this codebase has no generated Database type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterQuery = any;

async function selectWhere(
  admin: SupabaseClient,
  build: (query: FilterQuery) => FilterQuery,
): Promise<ListingRow[]> {
  const query = build(admin.from("directory_listing").select(MATCH_COLUMNS));
  const { data, error } = await query.limit(5);
  if (error) throw new Error(error.message);
  return (data ?? []) as ListingRow[];
}

function identityColumns(input: DirectoryListingInput) {
  const phone = listingPhoneE164(input);
  const domain = normalizeWebsiteDomain(input.website_url);
  const abn = normalizeAbn(input.abn);
  const sharePhone = input.phone_identity_shared === true || (phone != null && isSharedAuServiceNumber(phone));
  const shareDomain = input.domain_identity_shared === true;
  return {
    phone_e164: sharePhone ? null : phone,
    website_domain: shareDomain ? null : domain,
    abn,
    phone_identity_shared: sharePhone,
    domain_identity_shared: shareDomain,
  };
}

function buildInsert(input: DirectoryListingInput): Record<string, unknown> {
  const identity = identityColumns(input);
  const row: Record<string, unknown> = {
    business_name: input.business_name.trim(),
    source: input.source,
    is_claimed: input.is_claimed ?? false,
    ...identity,
  };
  const optional: (keyof DirectoryListingInput)[] = [
    "trades", "website_url", "suburb", "postcode", "latitude", "longitude", "place_id",
    "google_rating", "google_reviews_count", "photo_references", "scraped_contact_phone",
    "contact_phone", "scraped_contact_email", "private_email", "logo_url", "blurb",
    "profile_id", "street_address", "facebook_url", "instagram_url", "years_experience",
    "licenses", "services_offered", "services_extraction_method", "testimonials",
    "claim_pending_profile_id",
  ];
  for (const key of optional) {
    const value = input[key];
    if (value !== undefined && value !== null) row[key] = value;
  }
  if (input.trades) row.trades = input.trades;
  return row;
}

function buildUpdate(existing: ListingRow, input: DirectoryListingInput, refresh: boolean, overwrite: boolean): Record<string, unknown> {
  const identity = identityColumns({
    ...input,
    contact_phone: input.contact_phone ?? (existing.contact_phone as string | null),
    scraped_contact_phone: input.scraped_contact_phone ?? (existing.scraped_contact_phone as string | null),
    website_url: input.website_url ?? (existing.website_url as string | null),
    abn: input.abn ?? (existing.abn as string | null),
    phone_identity_shared: input.phone_identity_shared ?? (existing.phone_identity_shared as boolean | null) ?? false,
    domain_identity_shared: input.domain_identity_shared ?? (existing.domain_identity_shared as boolean | null) ?? false,
  });
  const patch: Record<string, unknown> = {
    ...identity,
    source: mergeDirectorySource(existing.source, input.source),
    updated_at: new Date().toISOString(),
  };

  const fillKeys: (keyof DirectoryListingInput)[] = [
    "website_url", "suburb", "postcode", "scraped_contact_phone", "contact_phone",
    "scraped_contact_email", "private_email", "logo_url", "blurb", "place_id",
    "street_address", "facebook_url", "instagram_url", "profile_id",
    "claim_pending_profile_id", "licenses", "testimonials", "services_extraction_method",
  ];
  for (const key of fillKeys) {
    const incoming = input[key];
    if (incoming == null || incoming === "") continue;
    if (overwrite || refresh || blank(existing[key])) patch[key] = incoming;
  }

  if (input.latitude != null && (refresh || existing.latitude == null)) patch.latitude = input.latitude;
  if (input.longitude != null && (refresh || existing.longitude == null)) patch.longitude = input.longitude;
  if (input.google_rating != null && (refresh || existing.google_rating == null)) patch.google_rating = input.google_rating;
  if (input.google_reviews_count != null && (refresh || existing.google_reviews_count == null)) {
    patch.google_reviews_count = input.google_reviews_count;
  }
  if (input.years_experience != null && (refresh || existing.years_experience == null)) {
    patch.years_experience = input.years_experience;
  }
  if (input.is_claimed === true) patch.is_claimed = true;

  const trades = [...new Set([
    ...((existing.trades as string[] | null) ?? []),
    ...(input.trades ?? []),
  ].filter(Boolean))];
  if (trades.length > 0) patch.trades = trades;

  const photos = [...new Set([
    ...((existing.photo_references as string[] | null) ?? []),
    ...(input.photo_references ?? []),
  ])].slice(0, 12);
  if (photos.length > 0 && (refresh || photos.length > ((existing.photo_references as string[] | null)?.length ?? 0))) {
    patch.photo_references = photos;
  }

  const services = [...new Set([
    ...((existing.services_offered as string[] | null) ?? []),
    ...(input.services_offered ?? []),
  ])].slice(0, 24);
  if (services.length > ((existing.services_offered as string[] | null)?.length ?? 0)) {
    patch.services_offered = services;
  }

  return patch;
}

interface IdentityLookup {
  match: ListingRow | null;
  /** An existing row already owns this phone in the suburb, and the names are different businesses. */
  suppressPhone: boolean;
  suppressDomain: boolean;
}

async function findIdentityMatch(admin: SupabaseClient, input: DirectoryListingInput): Promise<IdentityLookup> {
  const phone = normalizeAuPhone(input.contact_phone) ?? normalizeAuPhone(input.scraped_contact_phone);
  const domain = normalizeWebsiteDomain(input.website_url);
  const abn = normalizeAbn(input.abn);
  const suburb = input.suburb?.trim();
  const lookup: IdentityLookup = { match: null, suppressPhone: false, suppressDomain: false };

  if (input.place_id) {
    const rows = await selectWhere(admin, (query) => query.eq("place_id", input.place_id as string));
    if (rows[0]) return { ...lookup, match: rows[0] };
  }

  if (abn) {
    const rows = await selectWhere(admin, (query) => {
      const next = query.eq("abn", abn);
      return suburb ? next.ilike("suburb", suburb) : next;
    });
    if (rows[0]) return { ...lookup, match: rows[0] };
  }

  if (phone && suburb && !isSharedAuServiceNumber(phone)) {
    const rows = await selectWhere(admin, (query) => query.eq("phone_e164", phone).ilike("suburb", suburb));
    const compatible = rows.filter((row) => namesCompatible(String(row.business_name ?? ""), input.business_name));
    if (compatible[0]) return { ...lookup, match: compatible[0] };
    if (rows.length > 0) lookup.suppressPhone = true;
  }

  if (domain && suburb) {
    const rows = await selectWhere(admin, (query) => query.eq("website_domain", domain).ilike("suburb", suburb));
    const compatible = rows.filter((row) => namesCompatible(String(row.business_name ?? ""), input.business_name));
    if (compatible[0]) return { ...lookup, match: compatible[0] };
    if (rows.length > 0) lookup.suppressDomain = true;
  }

  if (suburb) {
    const rows = await selectWhere(admin, (query) => (
      query.ilike("business_name", input.business_name.trim()).ilike("suburb", suburb)
    ));
    const compatible = rows.filter((row) => namesCompatible(String(row.business_name ?? ""), input.business_name));
    if (compatible[0]) return { ...lookup, match: compatible[0] };
  }

  return lookup;
}

async function writeUpdate(
  admin: SupabaseClient,
  existing: ListingRow,
  input: DirectoryListingInput,
  refresh: boolean,
  overwrite: boolean,
): Promise<UpsertDirectoryResult> {
  const patch = buildUpdate(existing, input, refresh, overwrite);
  const { error } = await admin.from("directory_listing").update(patch).eq("id", existing.id);
  if (error) {
    if (isUniqueViolation(error)) {
      return { id: existing.id, action: "conflict", conflict: error.message };
    }
    throw new Error(error.message);
  }
  return { id: existing.id, action: "updated" };
}

export async function upsertDirectoryListing(
  admin: SupabaseClient,
  input: DirectoryListingInput,
  options?: UpsertDirectoryOptions,
): Promise<UpsertDirectoryResult> {
  const strategy = options?.strategy ?? "identity";
  const refresh = options?.refresh ?? false;
  const overwrite = options?.overwrite ?? false;
  const name = input.business_name?.trim();
  if (!name) return { id: null, action: "conflict", conflict: "business_name is required" };

  const named = { ...input, business_name: name };
  let toWrite = named;
  if (strategy === "identity") {
    const found = await findIdentityMatch(admin, named);
    if (found.match) return writeUpdate(admin, found.match, named, refresh, overwrite);
    if (found.suppressPhone || found.suppressDomain) {
      toWrite = {
        ...named,
        phone_identity_shared: named.phone_identity_shared || found.suppressPhone,
        domain_identity_shared: named.domain_identity_shared || found.suppressDomain,
      };
    }
  }

  const created = buildInsert(toWrite);
  const { data, error } = await admin.from("directory_listing").insert(created).select("id").single();
  if (!error && data) return { id: (data as { id: string }).id, action: "inserted" };

  if (error && isUniqueViolation(error)) {
    if (strategy === "insert") {
      return { id: null, action: "conflict", conflict: error.message };
    }
    const found = await findIdentityMatch(admin, named);
    if (found.match) return writeUpdate(admin, found.match, named, refresh, overwrite);
    return { id: null, action: "conflict", conflict: error.message };
  }

  throw new Error(error?.message || "directory listing upsert failed");
}
