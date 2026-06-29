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
