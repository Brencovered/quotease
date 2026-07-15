import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import ClientsPanel from "@/components/ClientsPanel";
import type { Client } from "@/lib/clients";

export default async function ClientsPage() {
  let clients: Client[] = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      // Fetch clients with aggregated job data
      const { data: rows } = await supabase
        .from("clients")
        .select("*, quotes(total_cost, created_at, status)")
        .eq("profile_id", businessId)
        .order("name");

      if (rows) {
        clients = rows.map((c: Record<string, unknown>) => {
          const quotes = (c.quotes as Array<{ total_cost: number | null; created_at: string; status: string }>) ?? [];
          const wonQuotes = quotes.filter((q) => q.status === "accepted" || q.status === "paid");
          const sorted = [...wonQuotes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          return {
            ...c,
            quotes: undefined,
            job_count: wonQuotes.length,
            total_spent: wonQuotes.reduce((s: number, q) => s + (q.total_cost ?? 0), 0),
            last_job_at: sorted[0]?.created_at ?? null,
          } as unknown as Client;
        });
      }
    }
  } catch (err) {
    console.error("Clients page error:", err);
  }

  return (
    <>
      <AppHeader />
      <ClientsPanel clients={clients} />
    </>
  );
}
