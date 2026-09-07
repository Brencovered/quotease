import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import DirectoryLeadsPanel from "@/components/DirectoryLeadsPanel";
import { getTeamContext, canSeePricing } from "@/lib/team";
import type { DirectoryLeadSummary } from "@/lib/directoryLeads";
import { signEnquiryPhotoPaths } from "@/lib/directoryEnquiryPhotos";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEADS_ENABLED } from "@/lib/featureFlags";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Owner/manager lead inbox for directory quote requests.
 * Marketplace claim flow stays behind LEADS_ENABLED as an optional extra.
 */
export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const ctx = await getTeamContext(supabase, userData.user.id);
  if (!(canSeePricing(ctx) || ctx.isOwner)) {
    redirect("/today");
  }

  const { data } = await supabase
    .from("directory_enquiries")
    .select(
      "id, lead_code, priority, urgency, pipeline_status, customer_name, customer_email, customer_phone, job_description, budget, customer_type, other_quotes, notes, site_suburb, photo_paths, business_name, is_claimed, profile_id, quote_id, job_id, created_at, status"
    )
    .eq("profile_id", ctx.businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  const admin = createAdminClient();
  const rows = await Promise.all(
    ((data ?? []) as DirectoryLeadSummary[]).map(async (row) => ({
      ...row,
      photo_urls: await signEnquiryPhotoPaths(admin, row.photo_paths),
    })),
  );

  return (
    <>
      <AppHeader />
      <main className="page-wrap pb-24 sm:pb-10">
        <DirectoryLeadsPanel rows={rows} mode="owner" />
        {LEADS_ENABLED && (
          <p className="mt-6 text-[13px] text-[var(--ink-faint)]">
            Looking for matched marketplace jobs?{" "}
            <Link href="/leads/marketplace" className="font-semibold text-[var(--navy)] underline">
              Open marketplace leads
            </Link>
          </p>
        )}
      </main>
    </>
  );
}
