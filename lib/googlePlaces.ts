const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

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
