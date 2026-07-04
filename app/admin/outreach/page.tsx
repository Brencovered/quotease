import { createAdminClient } from "@/lib/supabase/admin";
import AdminOutreachPanel from "@/components/AdminOutreachPanel";

export const dynamic = "force-dynamic";

type ListingRow = {
  id: string;
  business_name: string | null;
  email: string;
  trade: string | null;
  suburb: string | null;
  state: string | null;
};

async function fetchAllListings(admin: ReturnType<typeof createAdminClient>): Promise<ListingRow[]> {
  const PAGE = 1000;
  const all: ListingRow[] = [];
  const seen = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await admin
      .from("directory_listing")
      .select("id, business_name, scraped_contact_email, private_email, trade, suburb, state")
      .or("scraped_contact_email.not.is.null,private_email.not.is.null")
      .order("business_name")
      .range(from, from + PAGE - 1);

    if (error) { console.error("[outreach] listings error:", error); break; }
    if (!data?.length) break;

    for (const l of data) {
      // Prefer private_email (directly supplied), fall back to scraped
      const email = ((l.private_email ?? l.scraped_contact_email) as string | null)?.toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      all.push({
        id:            l.id,
        business_name: l.business_name,
        email,
        trade:         l.trade,
        suburb:        l.suburb,
        state:         l.state,
      });
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
}

async function fetchAllProfiles(admin: ReturnType<typeof createAdminClient>) {
  const PAGE = 1000;
  let all: { id: string; business_name: string | null; contact_email: string; trades: string[] | null; subscription_status: string | null }[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, business_name, contact_email, trades, subscription_status")
      .not("contact_email", "is", null)
      .order("business_name")
      .range(from, from + PAGE - 1);

    if (error) { console.error("[outreach] profiles error:", error); break; }
    if (!data?.length) break;

    all = [...all, ...data];
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
}

export default async function AdminOutreachPage() {
  const admin = createAdminClient();
  const [listings, profiles] = await Promise.all([
    fetchAllListings(admin),
    fetchAllProfiles(admin),
  ]);

  console.log(`[outreach] loaded ${listings.length} directory listings, ${profiles.length} profiles`);

  return (
    <AdminOutreachPanel
      directoryListings={listings}
      tradieProfiles={profiles}
    />
  );
}
