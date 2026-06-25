import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QuotesList from "@/components/QuotesList";

export default async function QuotesPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: quotes } = await supabase
    .from("quotes")
    .select("*")
    .eq("profile_id", userData.user.id)
    .order("created_at", { ascending: false });

  return <QuotesList quotes={quotes ?? []} />;
}
