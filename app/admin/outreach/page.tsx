import { createAdminClient } from "@/lib/supabase/admin";
import AdminOutreachPanel from "@/components/AdminOutreachPanel";

export const dynamic = "force-dynamic";

async function fetchAllListings(admin: ReturnType<typeof createAdminClient>) {
  const PAGE = 1000;
  let all: { id: string; business_name: string | null; email: string; trade: string | null; suburb: string | null; state: string | null }[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await admin
      .from("directory_listing")
      .select("id, business_name, private_email, trade, suburb, state")
      .not("private_email", "is", null)
      .order("business_name")
      .range(from, from + PAGE - 1);

    if (error || !data?.length) break;

    all = [...all, ...data.map(l => ({ ...l, email: l.private_email as string }))];
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

    if (error || !data?.length) break;

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

  return (
    <AdminOutreachPanel
      directoryListings={listings}
      tradieProfiles={profiles}
    />
  );
}
