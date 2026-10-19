import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import StructureEditor from "@/components/structures/StructureEditor";
import { structureTrade } from "@/lib/structurePlans";

export const dynamic = "force-dynamic";

export default async function StructureEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const businessId = await getActiveBusinessId(supabase, user.id);

  const { data: row } = await supabase
    .from("structure_plans")
    .select("id, name, client_id, quote_id, plan, updated_at, is_template")
    .eq("id", id)
    .eq("profile_id", businessId)
    .maybeSingle();
  if (!row) notFound();

  const plan = (row.plan ?? {}) as Record<string, unknown>;
  const kind: "build" | "house" = plan.kind === "house" ? "house" : "build";
  const isNew = kind === "build" && !("shed" in plan);
  const underlayPath = kind === "house" ? ((plan.underlay as { path?: string } | undefined)?.path ?? null) : null;

  const [{ data: clients }, { data: openQuotes }, { data: profile }, lastPricesRes, { data: templateRows }, { data: priceBook }] = await Promise.all([
    supabase.from("clients").select("id, name, billing_address").eq("profile_id", businessId).order("name").range(0, 999),
    supabase
      .from("quotes")
      .select("id, client_id, client_name, site_address, status, total_cost, created_at")
      .eq("profile_id", businessId)
      .in("status", ["draft", "sent", "accepted"])
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("business_name, trading_name, contact_phone, contact_email, hourly_rate, materials_margin_pct, trades")
      .eq("id", businessId)
      .single(),
    // Carry a business's own supplier prices from its most recent build into
    // a fresh one, so pricing is entered once, not per job.
    isNew
      ? supabase
          .from("structure_plans")
          .select("prices:plan->prices")
          .eq("profile_id", businessId)
          .neq("id", id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("structure_plans")
      .select("id, name, plan")
      .eq("profile_id", businessId)
      .eq("is_template", true)
      .neq("id", id)
      .order("name")
      .range(0, 99),
    // The business's own material price list. Planner lines link to these items.
    supabase
      .from("material_items")
      .select("id, label, unit_cost, trade, supplier")
      .eq("profile_id", businessId)
      .gt("unit_cost", 0)
      .range(0, 1999),
  ]);

  let underlayUrl: string | null = null;
  if (underlayPath) {
    const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(underlayPath, 3600 * 12);
    underlayUrl = signed?.signedUrl ?? null;
  }

  const lastPrices = (lastPricesRes.data as { prices?: Record<string, number> } | null)?.prices ?? null;

  return (
    <>
      <AppHeader />
      <StructureEditor
        id={row.id}
        businessId={businessId}
        isTemplate={Boolean(row.is_template)}
        priceBook={(priceBook ?? []).map((p) => ({
          id: String(p.id),
          label: String(p.label ?? ""),
          unit_cost: Number(p.unit_cost) || 0,
          trade: (p.trade as string | null) ?? "",
          supplier: (p.supplier as string | null) ?? "",
        }))}
        templates={(templateRows ?? []).map((t) => ({ id: t.id as string, name: t.name as string, plan: t.plan }))}
        initialName={row.name}
        initialClientId={row.client_id}
        linkedQuoteId={row.quote_id}
        plan={isNew ? null : plan}
        kind={kind}
        underlayUrl={underlayUrl}
        lastPrices={lastPrices && typeof lastPrices === "object" ? lastPrices : null}
        clients={clients ?? []}
        openQuotes={openQuotes ?? []}
        business={{
          name: profile?.trading_name || profile?.business_name || "",
          contact: [profile?.contact_phone, profile?.contact_email].filter(Boolean).join(" · "),
          hourlyRate: Number(profile?.hourly_rate) || 95,
          marginPct: Number(profile?.materials_margin_pct ?? 20),
          trade: structureTrade(profile?.trades as string[] | null),
          trades: (profile?.trades as string[] | null) ?? [],
        }}
      />
    </>
  );
}
