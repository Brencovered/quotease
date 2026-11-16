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
