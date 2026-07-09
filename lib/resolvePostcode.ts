import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves a postcode out of free text - either a suburb name someone
 * typed ("Seaford", "Seaford VIC", "Seaford 3198") or a bare postcode.
 * Used to backfill a real postcode wherever only suburb text exists:
 * the homeowner "Get Quotes" form only ever asks for a suburb, and a lot
 * of tradie profiles have a suburb but no postcode - both of these used
 * to leave lead matching with nothing solid to match on.
 *
 * Resolution order:
 *   1. An embedded 4-digit number in the text - most people who know
 *      their postcode just type it as part of the suburb field.
 *   2. A fuzzy suburb match against directory_listing (the same ~2711-row
 *      scraped AU suburb/postcode table the /directory search page and
 *      admin scraper already use as the canonical postcode source).
 *
 * Returns null if neither resolves anything - callers should fall back to
 * their previous suburb-text behaviour in that case, not silently drop
 * the location filter.
 */
export async function resolvePostcode(
  supabase: SupabaseClient,
  text: string | null | undefined
): Promise<string | null> {
  const trimmed = text?.trim();
  if (!trimmed) return null;

  const embedded = trimmed.match(/\b(\d{4})\b/);
  if (embedded) return embedded[1];

  const suburbOnly = trimmed.replace(/\b(VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\b/gi, "").trim();
  if (!suburbOnly) return null;

  const { data } = await supabase.rpc("resolve_postcode_for_suburb", { p_suburb: suburbOnly });
  if (data) return data as string;

  // Didn't resolve as-is - the person may have mistyped a trailing state
  // abbreviation ("Brighton viv" instead of "vic"), which the strip above
  // wouldn't catch. Retry with just the first word.
  const firstWord = suburbOnly.split(/\s+/)[0];
  if (firstWord && firstWord !== suburbOnly) {
    const { data: retry } = await supabase.rpc("resolve_postcode_for_suburb", { p_suburb: firstWord });
    return (retry as string | null) ?? null;
  }

  return null;
}
