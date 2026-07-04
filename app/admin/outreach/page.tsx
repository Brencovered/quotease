import { createAdminClient } from "@/lib/supabase/admin";
import AdminOutreachPanel from "@/components/AdminOutreachPanel";

export const dynamic = "force-dynamic";

export default async function AdminOutreachPage() {
  const admin = createAdminClient();
  const PAGE = 1000;

  // Fetch all directory listings -- paginate past the 1000 row default limit
  const listings: {
    id: string;
    business_name: string | null;
    email: string;
    trades: string[];
    suburb: string | null;
    postcode: string | null;
  }[] = [];

  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from("directory_listing")
      .select("id, business_name, scraped_contact_email, private_email, trades, suburb, postcode")
      .or("scraped_contact_email.not.is.null,private_email.not.is.null")
      .order("business_name")
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("[outreach] directory_listing error:", JSON.stringify(error));
      break;
    }
    if (!data?.length) break;

    const seen = new Set(listings.map(l => l.email));
    for (const l of data) {
      const email = ((l.private_email ?? l.scraped_contact_email) as string | null)?.toLowerCase().trim();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      listings.push({
        id:            l.id,
        business_name: l.business_name,
        email,
        trades:        (l.trades as string[]) ?? [],
        suburb:        l.suburb,
        postcode:      l.postcode,
      });
    }

    console.log(`[outreach] fetched rows ${from}–${from + data.length - 1}, total so far: ${listings.length}`);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Fetch registered profiles
  const profiles: {
    id: string;
    business_name: string | null;
    contact_email: string;
    trades: string[] | null;
    subscription_status: string | null;
  }[] = [];

  from = 0;
  while (true) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, business_name, contact_email, trades, subscription_status")
      .not("contact_email", "is", null)
      .order("business_name")
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("[outreach] profiles error:", JSON.stringify(error));
      break;
    }
    if (!data?.length) break;

    profiles.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`[outreach] final: ${listings.length} directory, ${profiles.length} profiles`);

  return (
    <AdminOutreachPanel
      directoryListings={listings}
      tradieProfiles={profiles}
    />
  );
}
