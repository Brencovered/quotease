import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";
import { PLUMBER_DEFAULT_MATERIALS } from "@/lib/calcPlumber";
import { CARPENTER_DEFAULT_MATERIALS } from "@/lib/calcCarpenter";
import { ROOFER_DEFAULT_MATERIALS } from "@/lib/calcRoofer";
import QuoteBuilder from "@/components/QuoteBuilder";
import PlumberQuoteBuilder from "@/components/PlumberQuoteBuilder";
import CarpenterQuoteBuilder from "@/components/CarpenterQuoteBuilder";
import RooferQuoteBuilder from "@/components/RooferQuoteBuilder";
import GenericQuoteBuilder from "@/components/GenericQuoteBuilder";
import AppHeader from "@/components/AppHeader";
import Link from "next/link";
import { ALL_TRADES } from "@/lib/genericTrades";

const DEDICATED_DEFAULTS: Record<string, readonly { item_key: string; label: string; unit_cost: number }[]> = {
  electrician: ELECTRICIAN_DEFAULT_MATERIALS,
  plumber:     PLUMBER_DEFAULT_MATERIALS,
  carpenter:   CARPENTER_DEFAULT_MATERIALS,
  roofer:      ROOFER_DEFAULT_MATERIALS,
};

const DEDICATED = ["electrician", "plumber", "carpenter", "roofer"];

const DEFAULT_PRICING_TIERS = [
  { name: "Standard", markup_pct: 0, sort_order: 0 },
  { name: "Premium", markup_pct: 10, sort_order: 1 },
  { name: "Trade", markup_pct: -5, sort_order: 2 },
];

const DEFAULT_JOB_SIZE_TIERS = [
  { name: "Small", max_days: 2, markup_pct: 5, sort_order: 0 },
  { name: "Medium", max_days: 5, markup_pct: 0, sort_order: 1 },
  { name: "Large", max_days: null, markup_pct: -3, sort_order: 2 },
];

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{
    trade?: string;
    client_id?: string;
    markup_materials?: string;
    plan_id?: string;
    package_id?: string;
    bundle_id?: string;
  }>;
}) {
  let { trade: tradeParm } = await searchParams;
  const {
    client_id: preClientId,
    markup_materials: preMarkup,
    plan_id: planId,
    package_id: packageId,
    bundle_id: bundleId,
  } = await searchParams;

  let profile: {
    hourly_rate: number;
    materials_margin_pct: number;
    trades?: string[];
    onboarded_at?: string | null;
  } = { hourly_rate: 95, materials_margin_pct: 20 };
  let materials: { item_key: string; label: string; unit_cost: number }[] = [];
  let activeTrades: string[] = [];
  let needsOnboarding = false;
  let preMarkupMaterials: Array<{
    label: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
  }> = [];

  // Material bundle loading via ?bundle_id=xxx
  let bundleMaterials: Array<{
    label: string; quantity: number; unit: string; unitCost: number; totalCost: number;
  }> = [];

  let pricingTiers: { id: string; name: string; markup_pct: number; sort_order: number }[] = [];
  let jobSizeTiers: { id: string; name: string; max_days: number | null; markup_pct: number; sort_order: number }[] = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(
        supabase,
        userData.user.id
      );
      const isTeamMember = businessId !== userData.user.id;
      const { data: dbProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", businessId)
        .single();
      if (dbProfile) {
        if (!dbProfile.onboarded_at && !isTeamMember) {
          needsOnboarding = true;
        } else {
          profile = dbProfile;
          activeTrades = dbProfile.trades ?? [];
        }
      }

      // Fetch pricing tiers (auto-seed defaults if empty)
      const { data: ptData } = await supabase
        .from("pricing_tiers")
        .select("id, name, markup_pct, sort_order")
        .eq("profile_id", businessId)
        .order("sort_order", { ascending: true });
      if (ptData && ptData.length > 0) {
        pricingTiers = ptData;
      } else {
        pricingTiers = DEFAULT_PRICING_TIERS.map((t, i) => ({ ...t, id: `default-pt-${i}`, profile_id: businessId }));
      }

      // Fetch job size tiers (auto-seed defaults if empty)
      const { data: jstData } = await supabase
        .from("job_size_tiers")
        .select("id, name, max_days, markup_pct, sort_order")
        .eq("profile_id", businessId)
        .order("sort_order", { ascending: true });
      if (jstData && jstData.length > 0) {
        jobSizeTiers = jstData;
      } else {
        jobSizeTiers = DEFAULT_JOB_SIZE_TIERS.map((t, i) => ({ ...t, id: `default-jst-${i}`, profile_id: businessId }));
      }

      let pkgForMaterials: {
        items: unknown;
        trade: string;
      } | null = null;

      if (packageId) {
        const { data: pkg } = await supabase
          .from("packages")
          .select("*, package_items(*)")
          .eq("id", packageId)
          .eq("profile_id", businessId)
          .single();
        if (pkg) {
          pkgForMaterials = {
            items: pkg.package_items,
            trade: pkg.trade,
          };
          if (!tradeParm) tradeParm = pkg.trade;
        }
      }

      // Material bundle loading via ?bundle_id=xxx
      if (bundleId) {
        const { data: bundle } = await supabase
          .from("material_bundles")
          .select("*, material_bundle_items(*)")
          .eq("id", bundleId)
          .eq("profile_id", businessId)
          .eq("status", "active")
          .single();
        if (bundle) {
          const items = (bundle.material_bundle_items ?? []) as Array<{
            label: string; qty: number; unit: string; unit_cost: number;
          }>;
          bundleMaterials = items
            .filter((i) => i.label)
            .map((i) => ({
              label: i.label,
              quantity: i.qty,
              unit: i.unit ?? "ea",
              unitCost: i.unit_cost ?? 0,
              totalCost: Math.round(i.qty * (i.unit_cost ?? 0)),
            }));
          if (!tradeParm) tradeParm = bundle.trade;
        }
      }

      /* Default the trade to the tradie's first active trade if the URL
         didn't specify one and no package/bundle set it. Without this, a
         plain visit to the new-quote page skipped the price book load
         entirely and fell back to hardcoded default materials with made-up
         prices -- quote items MUST come from the tradie's real supplier
         pricing wherever it exists. */
      if (!tradeParm && activeTrades.length > 0) tradeParm = activeTrades[0];

      if (tradeParm && DEDICATED.includes(tradeParm)) {
        /* Try price_book_items first (CSV uploads + supplier catalog).
           Paginated: PostgREST caps un-limited selects at 1000 rows, which
           silently dropped over half of a 2200-item catalog. */
        const PAGE = 1000;
        const pbAll: { id: string; description: string; cost_price: number | null }[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data: pageData, error: pageErr } = await supabase
            .from("price_book_items")
            .select("id,description,cost_price")
            .eq("profile_id", businessId)
            .eq("trade", tradeParm)
            .order("description")
            .range(from, from + PAGE - 1);
          if (pageErr || !pageData || pageData.length === 0) break;
          pbAll.push(...pageData);
          if (pageData.length < PAGE) break;
        }
        if (pbAll.length > 0) {
          materials = pbAll.map((m) => ({
            item_key: m.id,
            label: m.description,
            unit_cost: m.cost_price ?? 0,
          }));
        }
        /* Fallback to legacy material_items */
        if (materials.length === 0) {
          const legacyMats = await supabase
            .from("material_items")
            .select("*")
            .eq("profile_id", businessId)
            .eq("trade", tradeParm)
            .order("label");
          if (legacyMats.data && legacyMats.data.length > 0)
            materials = legacyMats.data;
        }
        /* Fallback to defaults */
        if (materials.length === 0) {
          const defaults = DEDICATED_DEFAULTS[tradeParm];
          if (defaults) materials = defaults.map((m) => ({ ...m }));
        }
      }

      if (planId) {
        const { data: plan } = await supabase
          .from("client_plans")
          .select("shapes")
          .eq("id", planId)
          .eq("profile_id", businessId)
          .single();
        const shapes =
          (plan?.shapes as Array<{
            label: string;
            material_label: string;
            unit_cost: number;
            margin_pct: number;
            qty: number;
            unit: string;
          }>) ?? [];
        preMarkupMaterials = shapes
          .filter((s) => s.material_label || s.label)
          .map((s) => ({
            label: s.material_label || s.label,
            quantity: s.qty,
            unit: s.unit,
            unitCost: +(s.unit_cost * (1 + s.margin_pct / 100)).toFixed(2),
            totalCost: Math.round(
              s.qty * s.unit_cost * (1 + s.margin_pct / 100)
            ),
          }));
      } else if (pkgForMaterials) {
        const items =
          (pkgForMaterials.items as Array<{
            label: string;
            qty: number;
            unit_cost: number;
            unit: string;
          }>) ?? [];
        preMarkupMaterials = items
          .filter((i) => i.label)
          .map((i) => ({
            label: i.label,
            quantity: i.qty,
            unit: i.unit ?? "ea",
            unitCost: i.unit_cost,
            totalCost: Math.round(i.qty * i.unit_cost),
          }));
      } else if (preMarkup) {
        const lump = parseInt(preMarkup);
        if (lump)
          preMarkupMaterials = [
            {
              label: "Materials from plan markup",
              quantity: 1,
              unit: "lot",
              unitCost: lump,
              totalCost: lump,
            },
          ];
      }

      // Merge bundle materials if no other pre-markup materials exist
      if (bundleMaterials.length > 0 && preMarkupMaterials.length === 0) {
        preMarkupMaterials = bundleMaterials;
      }
    }
  } catch (err) {
    console.error("New quote page error:", err);
  }

  if (needsOnboarding) redirect("/onboarding");

  const selectedTrade =
    tradeParm && activeTrades.includes(tradeParm)
      ? tradeParm
      : (activeTrades[0] ?? "electrician");

  return (
    <>
      <AppHeader />
      {activeTrades.length > 1 && (
        <div className="bg-[var(--surface)] border-b border-[var(--line)]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <span className="text-[12px] font-bold text-[var(--ink-faint)] uppercase tracking-wide mr-1 shrink-0">
              Trade:
            </span>
            {activeTrades.map((t) => {
              const meta = ALL_TRADES.find((x) => x.key === t);
              return (
                <Link
                  key={t}
                  href={`/electrician?trade=${t}`}
                  className={`px-4 py-1.5 rounded-lg text-[13px] font-bold capitalize whitespace-nowrap border-2 transition-colors ${
                    t === selectedTrade
                      ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                      : "border-[var(--line)] text-[var(--ink-soft)]"
                  }`}
                >
                  {meta?.label ?? t}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {selectedTrade === "electrician" && (
        <QuoteBuilder
          profile={profile}
          materials={materials}
          preClientId={preClientId}
          preMarkupMaterials={preMarkupMaterials}
          pricingTiers={pricingTiers}
          jobSizeTiers={jobSizeTiers}
        />
      )}
      {selectedTrade === "plumber" && (
        <PlumberQuoteBuilder
          profile={profile}
          materials={materials}
          preClientId={preClientId}
          preMarkupMaterials={preMarkupMaterials}
          pricingTiers={pricingTiers}
          jobSizeTiers={jobSizeTiers}
        />
      )}
      {selectedTrade === "carpenter" && (
        <CarpenterQuoteBuilder
          profile={profile}
          materials={materials}
          preClientId={preClientId}
          preMarkupMaterials={preMarkupMaterials}
          pricingTiers={pricingTiers}
          jobSizeTiers={jobSizeTiers}
        />
      )}
      {selectedTrade === "roofer" && (
        <RooferQuoteBuilder
          profile={profile}
          materials={materials}
          preClientId={preClientId}
          preMarkupMaterials={preMarkupMaterials}
          pricingTiers={pricingTiers}
          jobSizeTiers={jobSizeTiers}
        />
      )}
      {!DEDICATED.includes(selectedTrade) && (
        <GenericQuoteBuilder
          tradeKey={selectedTrade}
          profile={profile}
          preClientId={preClientId}
          preMarkupMaterials={preMarkupMaterials}
          pricingTiers={pricingTiers}
          jobSizeTiers={jobSizeTiers}
        />
      )}
    </>
  );
}
