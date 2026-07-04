import { createAdminClient } from "@/lib/supabase/admin";
import AdminOutreachPanel from "@/components/AdminOutreachPanel";

export const dynamic = "force-dynamic";

export default async function AdminOutreachPage() {
  const admin = createAdminClient();

  // Get directory listings with emails
  const { data: listings } = await admin
    .from("directory_listing")
    .select("id, business_name, email, trade, suburb, state")
    .not("email", "is", null)
    .order("business_name");

  // Get registered tradie profiles with emails
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, business_name, contact_email, trades, subscription_status")
    .not("contact_email", "is", null)
    .order("business_name");

  return (
    <AdminOutreachPanel
      directoryListings={listings ?? []}
      tradieProfiles={profiles ?? []}
    />
  );
}
