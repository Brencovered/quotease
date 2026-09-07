import { getPlaceReviews } from "@/lib/googleReviews";
import ReviewsSection from "./ReviewsSection";

/**
 * Fetches Google reviews and renders ReviewsSection - split out from
 * the main page's server component specifically so this fetch can be
 * wrapped in a <Suspense> boundary and streamed in separately, rather
 * than blocking the entire page's response.
 *
 * This matters more than it might for an ordinary external-API call:
 * Places API billing is currently off on the Google Cloud project
 * (confirmed via runtime logs earlier this session - every review
 * fetch fails with REQUEST_DENIED), so until that's re-enabled, this
 * call was adding real network round-trip time to every single
 * listing page view for a fetch that was guaranteed to fail. Even
 * once billing is back on, reviews aren't needed for the page's
 * critical content (services, contact, photos) - there's no reason
 * a third-party API call should ever sit in the critical path of
 * first paint.
 */
export default async function ReviewsSectionAsync({ placeId }: { placeId: string | null }) {
  const reviews = placeId ? await getPlaceReviews(placeId) : [];
  return <ReviewsSection reviews={reviews} />;
}
