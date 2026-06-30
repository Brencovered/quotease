import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import CommsPanel from "@/components/CommsPanel";

export default async function CommsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const businessId = await getActiveBusinessId(supabase, user.id);

  const { data: templates } = await supabase
    .from("communication_templates")
    .select("*")
    .eq("profile_id", businessId)
    .order("created_at", { ascending: false });

  const { data: branding } = await supabase
    .from("profiles")
    .select("business_name, logo_url, branding_primary_color, branding_tagline, branding_email_footer, contact_email, contact_phone")
    .eq("id", businessId)
    .single();

  const { data: outstandingJobs } = await supabase
    .from("quotes")
    .select("id, client_name, client_email, site_address, total_cost, amount_paid, completed_at, invoice_number")
    .eq("profile_id", businessId)
    .not("completed_at", "is", null)
    .gt("total_cost", 0)
    .or("amount_paid.lt.total_cost,amount_paid.is.null");

  const { data: expiringQuotes } = await supabase
    .from("quotes")
    .select("id, client_name, client_email, site_address, total_cost, quote_expires_at, sent_at, public_token")
    .eq("profile_id", businessId)
    .eq("status", "sent")
    .not("quote_expires_at", "is", null)
    .lte("quote_expires_at", new Date(Date.now() + 7 * 86400000).toISOString());

  return (
    <>
      <AppHeader />
      <div className="page-wrap">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-[28px] text-[var(--ink)]">Marketing &amp; Comms</h1>
            <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
              Email reminders, templates, quote branding, and brochures.
            </p>
          </div>
        </div>
        <CommsPanel
          initialTemplates={templates ?? []}
          branding={branding ?? {}}
          outstandingJobs={outstandingJobs ?? []}
          expiringQuotes={expiringQuotes ?? []}
          businessId={businessId}
        />
      </div>
    </>
  );
}
