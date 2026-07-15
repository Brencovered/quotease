import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/geocode";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import MapPanel from "@/components/MapPanel";

export default async function MapPage() {
  let jobs: Array<{
    id: string;
    job_id?: string | null;
    client_name: string | null;
    site_address: string | null;
    status: string;
    total_cost: number | null;
    site_lat: number | null;
    site_lng: number | null;
  }> = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      const { data } = await supabase
        .from("quotes")
        .select("id, client_name, site_address, status, total_cost, site_lat, site_lng")
        .eq("profile_id", businessId)
        .in("status", ["accepted", "paid"])
        .not("site_address", "is", null);

      if (data) {
        jobs = data;

        // These rows are quotes (accepted/paid ones, standing in for
        // "jobs" here), so `id` is the quote's id - but the map links
        // through to /jobs/[id], which needs the actual
        // job's id (a separate record created from the quote via
        // quote_id). Keep `id` as the quote id for the geocoding update
        // below and carry the real job id separately for the link.
        const { data: jobRows } = await supabase
          .from("jobs")
          .select("id, quote_id")
          .eq("profile_id", businessId)
          .in("quote_id", jobs.map((j) => j.id));
        const jobIdByQuoteId = new Map((jobRows ?? []).map((j) => [j.quote_id as string, j.id as string]));
        jobs = jobs.map((j) => ({ ...j, job_id: jobIdByQuoteId.get(j.id) ?? null }));

        // Geocode anything missing coordinates, one at a time (Nominatim's
        // usage policy asks for max 1 request/second) - and persist the
        // result so this only ever happens once per job, not on every
        // page load.
        const supabaseUpdate = supabase;
        for (const job of jobs) {
          if (job.site_lat == null && job.site_address) {
            const coords = await geocodeAddress(job.site_address);
            if (coords) {
              job.site_lat = coords.lat;
              job.site_lng = coords.lng;
              await supabaseUpdate.from("quotes").update({ site_lat: coords.lat, site_lng: coords.lng }).eq("id", job.id);
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Map page:", err);
  }

  return (
    <>
      <AppHeader />
      <MapPanel jobs={jobs.filter((j) => j.site_lat != null && j.site_lng != null)} />
    </>
  );
}
