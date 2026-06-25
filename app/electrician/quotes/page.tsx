import { createClient } from "@/lib/supabase/server";
import QuotesList from "@/components/QuotesList";
import AppHeader from "@/components/AppHeader";

export default async function QuotesPage() {
  let quotes: Array<Record<string, unknown>> = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: dbQuotes } = await supabase
        .from("quotes")
        .select("id, client_name, client_email, site_address, status, total_cost, amount_paid, payment_terms, invoice_number, xero_exported_at, completed_at, created_at, follow_up_at, quote_expires_at, sent_at")
        .eq("profile_id", userData.user.id)
        .order("created_at", { ascending: false });
      if (dbQuotes) quotes = dbQuotes;
    }
  } catch (err) {
    console.error("Quotes page:", err);
  }

  return (
    <>
      <AppHeader />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <QuotesList quotes={quotes as any} />
    </>
  );
}
