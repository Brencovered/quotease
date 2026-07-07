import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import QuotesList from "@/components/QuotesList";
import AppHeader from "@/components/AppHeader";

export default async function QuotesPage() {
  let quotes: Array<Record<string, unknown>> = [];
  let xeroConnected = false;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      const [{ data: dbQuotes }, { data: profile }] = await Promise.all([
        supabase
          .from("quotes")
          .select("id, client_name, client_email, site_address, status, total_cost, amount_paid, payment_terms, invoice_number, xero_exported_at, completed_at, created_at, follow_up_at, quote_expires_at, sent_at")
          .eq("profile_id", businessId)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("xero_tenant_id")
          .eq("id", businessId)
          .single(),
      ]);

      if (dbQuotes) quotes = dbQuotes;
      xeroConnected = !!profile?.xero_tenant_id;

      // A quote's own id and its job's id are different records (jobs
      // are a separate table, created from a quote via quote_id, with
      // their own auto-generated id) - accepted/paid quotes link
      // through to /electrician/jobs/[jobId], not /electrician/jobs/[quoteId].
      // Reusing the quote's id there 404s, since no job shares that id.
      const acceptedOrPaidIds = quotes.filter((q) => q.status === "accepted" || q.status === "paid").map((q) => q.id as string);
      if (acceptedOrPaidIds.length > 0) {
        const { data: jobRows } = await supabase
          .from("jobs")
          .select("id, quote_id")
          .eq("profile_id", businessId)
          .in("quote_id", acceptedOrPaidIds);
        const jobIdByQuoteId = new Map((jobRows ?? []).map((j) => [j.quote_id, j.id]));
        quotes = quotes.map((q) => ({ ...q, job_id: jobIdByQuoteId.get(q.id as string) ?? null }));
      }
    }
  } catch (err) {
    console.error("Quotes page:", err);
  }

  return (
    <>
      <AppHeader />
      <Suspense>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <QuotesList quotes={quotes as any} xeroConnected={xeroConnected} />
      </Suspense>
    </>
  );
}
