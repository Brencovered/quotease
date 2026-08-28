const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

/** True when Google is blocking Places until Cloud Billing is enabled. */
export function isPlacesBillingBlock(status?: string, errorMessage?: string): boolean {
  const blob = `${status ?? ""} ${errorMessage ?? ""}`;
  return /enable billing|gmp-get-started|billing on the google cloud project/i.test(blob);
}

/** Admin-facing copy for a Places JSON status. Never pass Google's billing URL through as-is. */
export function formatPlacesApiError(status: string, errorMessage?: string): string {
  if (isPlacesBillingBlock(status, errorMessage)) {
    return "Google Places cannot run because billing is off on the Google Cloud project for this API key. The trade-and-postcode Google scraper needs that. For a pasted Maps URL, use Page scraper: we look the same search up on Yellow Pages instead.";
  }
  if (status === "REQUEST_DENIED") {
    return "Google Places rejected this API key (REQUEST_DENIED). Check key restrictions and that Places API is enabled.";
  }
  if (status === "OVER_QUERY_LIMIT") {
    return "Google Places hit its quota. Try again in a few minutes.";
  }
  return errorMessage && !/gmp-get-started|console\.cloud\.google/i.test(errorMessage)
    ? errorMessage
    : `Google Places failed (${status}).`;
}

export interface GoogleListingData {
  place_id: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  photo_references: string[];
  formatted_phone_number: string | null;
  website: string | null;
  formatted_address: string | null;
}

const EMPTY: GoogleListingData = {
  place_id: null, google_rating: null, google_reviews_count: null,
  photo_references: [], formatted_phone_number: null, website: null, formatted_address: null,
};

/**
 * Finds a specific business by name + suburb and pulls its rating,
 * review count, and photos - the same fields the scraper stores, just for
 * one named business instead of a broad nearby-search sweep. Returns the
 * EMPTY shape (never throws) if the key isn't configured, nothing matches,
 * or the API call fails - a manual listing should still get created even
 * if this enrichment step can't complete.
 */
export async function findAndFetchGoogleListing(businessName: string, suburb: string | null): Promise<GoogleListingData> {
  if (!GOOGLE_API_KEY || !businessName) return EMPTY;

  try {
    const input = suburb ? `${businessName} ${suburb} Australia` : `${businessName} Australia`;
    const findParams = new URLSearchParams({
      input,
      inputtype: "textquery",
      fields: "place_id",
      key: GOOGLE_API_KEY,
    });
    const findRes = await fetch(`${FIND_PLACE_URL}?${findParams.toString()}`, { signal: AbortSignal.timeout(10000) });
    if (!findRes.ok) return EMPTY;
    const findData = (await findRes.json()) as { candidates?: { place_id: string }[]; status: string };
    const placeId = findData.candidates?.[0]?.place_id;
    if (findData.status !== "OK" || !placeId) return EMPTY;

    const fields = "rating,user_ratings_total,photos,formatted_phone_number,website,formatted_address";
    const detailsRes = await fetch(`${DETAILS_URL}?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!detailsRes.ok) return { ...EMPTY, place_id: placeId };
    const detailsData = (await detailsRes.json()) as {
      result?: {
        rating?: number; user_ratings_total?: number;
        photos?: { photo_reference: string }[];
        formatted_phone_number?: string; website?: string; formatted_address?: string;
      };
      status: string;
    };
    if (detailsData.status !== "OK" || !detailsData.result) return { ...EMPTY, place_id: placeId };

    const r = detailsData.result;
    return {
      place_id: placeId,
      google_rating: r.rating ?? null,
      google_reviews_count: r.user_ratings_total ?? null,
      photo_references: (r.photos ?? []).slice(0, 6).map((p) => p.photo_reference),
      formatted_phone_number: r.formatted_phone_number ?? null,
      website: r.website ?? null,
      formatted_address: r.formatted_address ?? null,
    };
  } catch (err) {
    console.error("[googlePlaces] lookup failed for", businessName, err);
    return EMPTY;
  }
}
