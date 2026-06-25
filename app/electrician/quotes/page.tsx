import { createClient } from "@/lib/supabase/server";
import QuotesList from "@/components/QuotesList";

export default async function QuotesPage() {
  let quotes: Array<Record<string, unknown>> = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: dbQuotes } = await supabase
        .from("quotes")
        .select("*")
        .eq("profile_id", userData.user.id)
        .order("created_at", { ascending: false });
      if (dbQuotes) quotes = dbQuotes;
    }
  } catch (err) {
    console.error("Quotes page: falling back to empty list —", err);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <QuotesList quotes={quotes as any} />;
}
