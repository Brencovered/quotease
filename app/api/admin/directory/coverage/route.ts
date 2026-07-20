import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

// This reflects live scrape/refresh actions the admin just ran -- it must
// never be cached, by Next.js, Vercel's edge, or the browser. Explicit
// rather than relying on cookies() usage elsewhere in the file to opt
// this route out of caching implicitly.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Approximate official Australia Post postcode ranges. Good enough for a
// heuristic state grouping on an admin dashboard -- not meant to be exact
// for edge-case PO box ranges.
function postcodeToState(pc: string): string {
  const n = parseInt(pc, 10);
  if (isNaN(n)) return "?";
  if (n >= 800 && n <= 899) return "NT";
  if ((n >= 2600 && n <= 2618) || (n >= 2900 && n <= 2920)) return "ACT";
  if ((n >= 1000 && n <= 2599) || (n >= 2619 && n <= 2899) || (n >= 2921 && n <= 2999)) return "NSW";
  if (n >= 3000 && n <= 3999) return "VIC";
  if (n >= 4000 && n <= 4999) return "QLD";
  if (n >= 5000 && n <= 5799) return "SA";
  if (n >= 6000 && n <= 6797) return "WA";
  if (n >= 7000 && n <= 7799) return "TAS";
  return "?";
}

/**
 * Postcode x trade coverage matrix for the admin dashboard -- "which areas
 * and trades are thin" rather than a literal map (an embedded Google Maps
 * view would need its own Maps JavaScript API key/billing for comparatively
 * little extra insight over a sortable, colour-coded table grouped by
 * postcode/state).
 *
 * Important limitation: this only ever shows postcodes that already have
 * at least one listing. It can't surface postcodes with zero coverage at
 * all, since there's no canonical "every Australian postcode" reference
 * table in this schema to diff against -- it highlights weak spots within
 * existing data, not blind spots outside it.
 */
export async function GET() {
  const authClient = await createClient();
  const { data: userData } = await authClient.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("directory_listing")
    .select("postcode, suburb, trades");

  if (error) {
    return NextResponse.json({ error: "Failed to load coverage data" }, { status: 500 });
  }

  type Bucket = {
    postcode: string;
    state: string;
    suburbCounts: Record<string, number>;
    byTrade: Record<string, number>;
    total: number;
  };

  const buckets = new Map<string, Bucket>();

  for (const row of rows ?? []) {
    const postcode = row.postcode?.trim();
    if (!postcode) continue;

    let bucket = buckets.get(postcode);
    if (!bucket) {
      bucket = { postcode, state: postcodeToState(postcode), suburbCounts: {}, byTrade: {}, total: 0 };
      buckets.set(postcode, bucket);
    }

    bucket.total++;
    if (row.suburb) {
      bucket.suburbCounts[row.suburb] = (bucket.suburbCounts[row.suburb] ?? 0) + 1;
    }
    for (const t of (row.trades ?? []) as string[]) {
      bucket.byTrade[t] = (bucket.byTrade[t] ?? 0) + 1;
    }
  }

  const postcodes = Array.from(buckets.values()).map((b) => {
    // Most common suburb name recorded for this postcode -- postcodes can
    // span multiple suburbs, this just labels the row with the dominant one.
    const suburb = Object.entries(b.suburbCounts).sort((a, z) => z[1] - a[1])[0]?.[0] ?? "";
    return {
      postcode: b.postcode,
      state: b.state,
      suburb,
      total: b.total,
      byTrade: b.byTrade,
    };
  });

  postcodes.sort((a, z) => z.total - a.total);

  return NextResponse.json(
    {
      postcodes,
      postcodeCount: postcodes.length,
      stateCount: new Set(postcodes.map((p) => p.state)).size,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
