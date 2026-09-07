import { createAdminClient } from "@/lib/supabase/admin";
import DirectoryTrafficPanel from "./DirectoryTrafficPanel";

/**
 * Looks up the tradie's claimed listing (if any) and its last 30 days
 * of cached traffic (see directory_listing_traffic_daily, synced
 * nightly from PostHog - lib/directoryTrafficSync.ts), then renders
 * the display panel. Split into its own async component and wrapped
 * in <Suspense> at the call site so a slow or failed lookup here
 * never blocks the rest of Settings from rendering - same reasoning
 * as ReviewsSectionAsync on the public listing page: this is
 * supplementary information, not something worth holding up the page
 * for.
 */
export default async function DirectoryTrafficData({ profileId }: { profileId: string }) {
  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("directory_listing")
    .select("id, business_name")
    .eq("profile_id", profileId)
    .eq("is_claimed", true)
    .maybeSingle();

  if (!listing) return null;

  const { data: traffic } = await admin
    .from("directory_listing_traffic_daily")
    .select("day, pageviews, cta_clicks")
    .eq("listing_id", listing.id)
    .order("day", { ascending: true })
    .limit(30);

  return <DirectoryTrafficPanel businessName={listing.business_name} traffic={traffic ?? []} />;
}
