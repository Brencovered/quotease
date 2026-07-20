/**
 * lib/googleReviews.ts
 * ---------------------
 * Fetches a handful of real Google reviews for a directory listing via the
 * Places API's Place Details endpoint, for display on the listing's own
 * profile page. Complements the aggregate rating/count already scraped
 * into directory_listing (google_rating, google_reviews_count) with actual
 * review text.
 *
 * Reviews are "Atmosphere Data" under Google's Places API pricing (unlike
 * the Basic Data already scraped for rating/phone/photos), so this is a
 * genuine per-call cost -- kept in check with Next's fetch cache rather
 * than calling on every page view. revalidate matches the directory's
 * existing 1-week assumption (see app/sitemap.ts) that listing data
 * doesn't change fast enough to need fresher reviews than that.
 */

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export interface GoogleReview {
  authorName: string;
  authorPhotoUrl: string | null;
  rating: number;
  relativeTime: string;
  text: string;
  time: number; // unix seconds, for stable sort order
}

/**
 * Returns up to 5 of Google's "most relevant" reviews for a place, or an
 * empty array if the key isn't configured, the place has none, or the
 * request fails for any reason -- this is supplementary content, so it
 * should never be the thing that breaks a listing page.
 */
export async function getPlaceReviews(placeId: string): Promise<GoogleReview[]> {
  if (!API_KEY || !placeId) return [];

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=reviews&key=${API_KEY}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 604800 }, // 7 days
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[googleReviews] Place Details HTTP ${res.status} for ${placeId}`);
      return [];
    }

    const data = await res.json();
    // Google's Places API returns HTTP 200 even for key/quota/billing
    // problems -- the actual outcome is in the JSON body's status field
    // (OK, ZERO_RESULTS, OVER_QUERY_LIMIT, REQUEST_DENIED, INVALID_REQUEST,
    // UNKNOWN_ERROR). Log anything other than OK/ZERO_RESULTS so a
    // sitewide failure (e.g. quota exhausted) is actually visible instead
    // of just quietly returning no reviews everywhere.
    if (data?.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error(`[googleReviews] Places API status "${data.status}" for ${placeId}: ${data.error_message ?? ""}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviews = data?.result?.reviews as any[] | undefined;
    if (!Array.isArray(reviews)) return [];

    return reviews
      .filter((r) => typeof r?.text === "string" && r.text.trim().length > 0)
      .map((r) => ({
        authorName: typeof r.author_name === "string" ? r.author_name : "Google user",
        authorPhotoUrl: typeof r.profile_photo_url === "string" ? r.profile_photo_url : null,
        rating: typeof r.rating === "number" ? r.rating : 0,
        relativeTime: typeof r.relative_time_description === "string" ? r.relative_time_description : "",
        text: r.text.trim(),
        time: typeof r.time === "number" ? r.time : 0,
      }))
      .sort((a, b) => b.time - a.time);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}
