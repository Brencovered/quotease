import { buildDirectorySlug } from "@/lib/seo/meta";

const LEGACY_DIRECTORY_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DirectorySlugSource = {
  id: string;
  business_name: string;
  suburb?: string | null;
};

/** True when the path segment is a raw directory_listing id from before pretty slugs. */
export function isLegacyDirectoryUuid(slug: string): boolean {
  return LEGACY_DIRECTORY_UUID.test(slug);
}

/** Canonical path for a listing. Never the raw UUID, including when suburb is blank. */
export function directoryProfilePath(listing: DirectorySlugSource): string {
  return `/directory/${buildDirectorySlug({
    id: listing.id,
    business_name: listing.business_name,
    suburb: listing.suburb ?? "",
  })}`;
}

const LISTING_SLUG_SUFFIX = /-([0-9a-f]{6})$/i;

/**
 * Trailing id suffix of a pretty listing slug. Null for UUIDs and for
 * paths that were never a listing URL.
 */
export function listingSlugSuffix(slug: string): string | null {
  const match = LISTING_SLUG_SUFFIX.exec(slug);
  return match ? match[1].toLowerCase() : null;
}

/**
 * When several rows share a 6-hex suffix, only the row whose current
 * canonical slug is the one requested is that URL. Returning either row
 * would publish the wrong business; returning none is what used to 404
 * both of them.
 */
export function chooseListingForSlug<T extends DirectorySlugSource>(
  slug: string,
  rows: readonly T[],
): T | null {
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];
  return rows.find((row) => directoryProfilePath(row) === `/directory/${slug}`) ?? null;
}

/**
 * 308 target when the request is not already the listing's canonical path.
 * Covers raw UUIDs and pretty slugs left behind after a rename. The
 * canonical path itself returns null so the page does not redirect to itself.
 */
export function nonCanonicalListingRedirect(
  requestedSlug: string,
  listing: DirectorySlugSource,
): string | null {
  const canonical = directoryProfilePath(listing);
  if (requestedSlug === canonical.slice("/directory/".length)) return null;
  return canonical;
}

/**
 * Legacy UUID URLs 308 to the pretty slug. A request that is already a
 * slug stays put; the page's own canonical tag is the pretty slug, and
 * redirecting it would loop or hide a real URL.
 */
export function legacyUuidRedirectPath(
  requestedSlug: string,
  listing: DirectorySlugSource,
): string | null {
  if (!isLegacyDirectoryUuid(requestedSlug)) return null;
  return directoryProfilePath(listing);
}

export type SuburbHubCandidate = {
  suburbSlug: string;
  state: string;
  count: number;
};

/**
 * Trailing hyphen segments of a pretty slug, longest first, excluding the
 * business-name prefix. `buildDirectorySlug` puts the suburb at the end,
 * so the longest segment that is a real suburb is the one to keep.
 */
export function suburbSlugCandidatesFromListingSlug(slug: string): string[] {
  const suffix = listingSlugSuffix(slug);
  if (!suffix) return [];
  const body = slug.slice(0, -(suffix.length + 1));
  const parts = body.split("-").filter(Boolean);
  const candidates: string[] = [];
  for (let start = 1; start < parts.length; start++) {
    candidates.push(parts.slice(start).join("-"));
  }
  return candidates.sort((a, b) => b.length - a.length);
}

/**
 * Where a deleted listing URL should send Google. Prefer the suburb hub
 * for the longest matching suburb. Two states with the same listing count
 * is a guess, so that falls through to the directory.
 */
export function removedListingRedirectPath(
  slug: string,
  hubs: readonly SuburbHubCandidate[],
): string {
  const wanted = new Set(suburbSlugCandidatesFromListingSlug(slug));
  const matches = hubs.filter((hub) => hub.suburbSlug && wanted.has(hub.suburbSlug) && (hub.count ?? 0) > 0);
  if (matches.length === 0) return "/directory";
  const longest = Math.max(...matches.map((hub) => hub.suburbSlug.length));
  const best = matches
    .filter((hub) => hub.suburbSlug.length === longest)
    .map((hub) => ({ ...hub, state: hub.state.toLowerCase() }))
    .sort((a, b) => b.count - a.count);
  const top = best[0];
  const tiedState = best.some((hub) => hub.count === top.count && hub.state !== top.state);
  if (tiedState) return "/directory";
  return `/tradies-in/${top.suburbSlug}-${top.state}`;
}
