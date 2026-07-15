import { createAdminClient } from "@/lib/supabase/admin";
import AdminRoadmapPanel from "@/components/AdminRoadmapPanel";

export const dynamic = "force-dynamic";

export default async function AdminRoadmapPage() {
  const admin = createAdminClient();

  const { data: items } = await admin
    .from("roadmap_items")
    .select("*")
    .order("priority_order", { ascending: true })
    .order("created_at", { ascending: false });

  return <AdminRoadmapPanel items={items ?? []} />;
}
