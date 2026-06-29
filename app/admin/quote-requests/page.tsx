import { createAdminClient } from "@/lib/supabase/admin";
import AdminQuoteRequestsPanel from "@/components/AdminQuoteRequestsPanel";

export const dynamic = "force-dynamic";

export default async function AdminQuoteRequestsPage() {
  const admin = createAdminClient();

  const { data: requests } = await admin
    .from("job_requests")
    .select("id, homeowner_id, trade, suburb, postcode, description, budget, timeline, num_quotes_wanted, lead_temperature, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const homeownerIds = Array.from(new Set((requests ?? []).map((r) => r.homeowner_id).filter(Boolean))) as string[];

  const { data: homeowners } = homeownerIds.length
    ? await admin.from("homeowner_profiles").select("id, name, email, phone").in("id", homeownerIds)
    : { data: [] };

  const homeownerMap = new Map((homeowners ?? []).map((h) => [h.id, h]));

  const rows = (requests ?? []).map((r) => ({
    ...r,
    homeowner: r.homeowner_id ? homeownerMap.get(r.homeowner_id) ?? null : null,
  }));

  return <AdminQuoteRequestsPanel rows={rows} />;
}
