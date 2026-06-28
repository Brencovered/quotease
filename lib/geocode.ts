// OpenStreetMap's free geocoder. No API key, no cost - the tradeoff is a
// usage policy that asks for a real User-Agent and no heavy/bulk use,
// which is exactly the shape of this app's traffic (a handful of
// geocodes per tradie, cached forever via site_lat/site_lng on the quote
// row, never re-geocoded). If job volume ever gets large enough that this
// stops being a fair amount of free-tier load, switching to Mapbox or
// Google's paid geocoding is a one-function change, not a rebuild.
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address?.trim()) return null;
  try {
    // countrycodes=au stops ambiguous Australian place names (Seaford exists
    // in the UK and South Australia as well as Victoria, for example) from
    // matching a result on the other side of the world.
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=au&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Swiftscope (quoting software for trades) - contact via app" },
    });
    if (!res.ok) return null;
    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  } catch {
    return null;
  }
}
