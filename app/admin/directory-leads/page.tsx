import { createAdminClient } from "@/lib/supabase/admin";
import DirectoryLeadsPanel from "@/components/DirectoryLeadsPanel";
import type { DirectoryLeadSummary } from "@/lib/directoryLeads";
import { signEnquiryPhotoPaths } from "@/lib/directoryEnquiryPhotos";

export const dynamic = "force-dynamic";

export default async function AdminDirectoryLeadsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("directory_enquiries")
    .select(
      "id, lead_code, priority, urgency, pipeline_status, customer_name, customer_email, customer_phone, job_description, budget, customer_type, other_quotes, notes, site_suburb, photo_paths, business_name, is_claimed, profile_id, quote_id, job_id, created_at, status"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = await Promise.all(
    ((data ?? []) as DirectoryLeadSummary[]).map(async (row) => ({
      ...row,
      photo_urls: await signEnquiryPhotoPaths(admin, row.photo_paths),
    })),
  );

  return <DirectoryLeadsPanel rows={rows} mode="admin" />;
}
