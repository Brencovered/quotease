import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import PlansPageClient from "@/components/PlansPageClient";

export default async function PlansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const businessId = await getActiveBusinessId(supabase, user.id);

  // All clients for this business (for grouping plans by client)
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, billing_address")
    .eq("profile_id", businessId)
    .order("name");

  // All plans for this business's clients
  const { data: plans } = await supabase
    .from("client_plans")
    .select("id, client_id, file_name, label, storage_path, shapes, calibration, created_at")
    .eq("profile_id", businessId)
    .order("created_at", { ascending: false });

  // Sign URLs
  const plansWithUrls = await Promise.all(
    (plans ?? []).map(async (p) => {
      const { data: signed } = await supabase.storage
        .from("job-files")
        .createSignedUrl(p.storage_path, 3600 * 24);
      return { ...p, signedUrl: signed?.signedUrl ?? null };
    })
  );

  // Load trade materials
  const { data: profile } = await supabase
    .from("profiles")
    .select("trades, hourly_rate, materials_margin_pct")
    .eq("id", businessId)
    .single();

  // Load materials for all trades
  const allTrades = profile?.trades ?? ["electrician"];
  const { data: materials } = await supabase
    .from("material_items")
    .select("item_key, label, unit_cost, trade")
    .eq("profile_id", businessId)
    .in("trade", allTrades)
    .order("label");

  // Open quotes/jobs to attach markup costs to
  const { data: openQuotes } = await supabase
    .from("quotes")
    .select("id, client_id, client_name, site_address, status, total_cost, trade")
    .eq("profile_id", businessId)
    .in("status", ["draft", "sent", "accepted"])
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <AppHeader />
      <div className="page-wrap-narrow">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-[26px] text-[var(--ink)]">Plans &amp; Drawings</h1>
            <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
              Mark up site plans, measure from drawings, link materials and costs to quotes.
            </p>
          </div>
        </div>
        <PlansPageClient
          clients={clients ?? []}
          plans={plansWithUrls}
          materials={materials ?? []}
          marginPct={profile?.materials_margin_pct ?? 20}
          openQuotes={openQuotes ?? []}
          trades={allTrades}
        />
      </div>
    </>
  );
}
