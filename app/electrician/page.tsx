import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import {
  getCachedPriceBook,
  getCachedLegacyMaterials,
  getCachedPricingTiers,
  getCachedJobSizeTiers,
  getCachedProfile,
} from "@/lib/cache";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";
import { PLUMBER_DEFAULT_MATERIALS } from "@/lib/calcPlumber";
import { CARPENTER_DEFAULT_MATERIALS } from "@/lib/calcCarpenter";
import { ROOFER_DEFAULT_MATERIALS } from "@/lib/calcRoofer";
import QuoteBuilderDynamic from "@/components/QuoteBuilderDynamic";
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

/* ── helpers for optional package / bundle / plan / markup data ── */

async function loadPackage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  packageId: string | undefined,
  tradeParm: string | undefined
) {
  if (!packageId) return null;
  const { data: pkg } = await supabase
    .from("packages")
    .select("*, package_items(*)")
    .eq("id", packageId)
    .eq("profile_id", businessId)
    .single();

  if (!pkg) return null;

  const items = (pkg.package_items ?? []) as Array<{
    label: string; qty: number; unit_cost: number; unit: string;
  }>;
  const preMarkup: Array<{
    label: string; quantity: number; unit: string; unitCost: number; totalCost: number; labourHrs?: number;
  }> = items
    .filter((i) => i.label)
    .map((i) => ({
      label: i.label,
      quantity: i.qty,
      unit: i.unit ?? "ea",
      unitCost: i.unit_cost,
      totalCost: Math.round(i.qty * i.unit_cost),
    }));

  // Packages carry a single labour_hours estimate for the whole package
  if (pkg.labour_hours) {
    if (preMarkup.length > 0) {
      preMarkup[0] = { ...preMarkup[0], labourHrs: pkg.labour_hours };
    } else {
      preMarkup.push({
        label: "Package labour",
        quantity: 0,
        unit: "",
        unitCost: 0,
        totalCost: 0,
        labourHrs: pkg.labour_hours,
      });
    }
  }

  return { preMarkup, trade: pkg.trade as string, labourHours: pkg.labour_hours as number | null };
}

async function loadBundle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  bundleId: string | undefined,
  tradeParm: string | undefined
) {
  if (!bundleId) return { materials: [] as Array<{ label: string; quantity: number; unit: string; unitCost: number; totalCost: number }>, trade: tradeParm };

  const { data: bundle } = await supabase
    .from("material_bundles")
    .select("*, material_bundle_items(*)")
    .eq("id", bundleId)
    .eq("profile_id", businessId)
    .eq("status", "active")
    .single();

  if (!bundle) return { materials: [] as Array<{ label: string; quantity: number; unit: string; unitCost: number; totalCost: number }>, trade: tradeParm };

  const items = (bundle.material_bundle_items ?? []) as Array<{
    label: string; qty: number; unit: string; unit_cost: number;
  }>;

  return {
    materials: items
      .filter((i) => i.label)
      .map((i) => ({
        label: i.label,
        quantity: i.qty,
        unit: i.unit ?? "ea",
        unitCost: i.unit_cost ?? 0,
        totalCost: Math.round(i.qty * (i.unit_cost ?? 0)),
      })),
    trade: bundle.trade as string,
  };
}

async function loadPlanMarkup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  planId: string | undefined
) {
  if (!planId) return [];
  const { data: plan } = await supabase
    .from("client_plans")
    .select("shapes")
    .eq("id", planId)
    .eq("profile_id", businessId)
    .single();

  const shapes = (plan?.shapes as Array<{
    label: string; material_label: string; unit_cost: number;
    margin_pct: number; qty: number; unit: string;
  }>) ?? [];

  return shapes
    .filter((s) => s.material_label || s.label)
    .map((s) => ({
      label: s.material_label || s.label,
      quantity: s.qty,
      unit: s.unit,
      // Raw cost only -- no per-shape margin baked in here. The quote's
      // effective margin gets applied once, uniformly, when these are
      // merged into the wizard's siteItems list. Baking margin in here
      // AND applying the wizard's margin on top double-charged the
      // client for every plan-markup material.
      unitCost: s.unit_cost,
      totalCost: Math.round(s.qty * s.unit_cost),
    }));
}

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

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const businessId = await getActiveBusinessId(supabase, userData.user.id);
  const isTeamMember = businessId !== userData.user.id;

  /* ── 1. Profile (cached) ── */
  const dbProfile = await getCachedProfile(businessId);

  if (!dbProfile) {
    // extreme fallback — shouldn't happen for a logged-in user
    return (
      <>
        <AppHeader />
        <main className="page-wrap-narrow py-12 text-center">
          <p className="text-[var(--ink-faint)]">Something went wrong loading your profile.</p>
        </main>
      </>
    );
  }

  if (!dbProfile.onboarded_at && !isTeamMember) {
    redirect("/onboarding");
  }

  const activeTrades = dbProfile.trades ?? [];

  /* ── 2. Default the trade ── */
  if (!tradeParm && activeTrades.length > 0) tradeParm = activeTrades[0];

  const selectedTrade =
    tradeParm && activeTrades.includes(tradeParm)
      ? tradeParm
      : (activeTrades[0] ?? "electrician");

  /* ── 3. Fetch EVERYTHING in parallel ── */
  const [
    pricingTiers,
    jobSizeTiers,
    pkgData,
    bundleData,
    planMaterials,
  ] = await Promise.all([
    getCachedPricingTiers(businessId),
    getCachedJobSizeTiers(businessId),
    loadPackage(supabase, businessId, packageId, tradeParm),
    loadBundle(supabase, businessId, bundleId, tradeParm),
    loadPlanMarkup(supabase, businessId, planId),
  ]);

  /* ── 4. Resolve trade from package/bundle ── */
  let effectiveTrade = selectedTrade;
  if (pkgData?.trade) effectiveTrade = pkgData.trade;
  if (bundleData.trade) effectiveTrade = bundleData.trade;

  /* ── 5. Resolve pre-markup materials ── */
  let preMarkupMaterials: Array<{
    label: string; quantity: number; unit: string; unitCost: number;
    totalCost: number; labourHrs?: number;
  }> = [];

  let preMarkupSource: "package" | "plan markup" | "material bundle" = "plan markup";

  if (pkgData?.preMarkup && pkgData.preMarkup.length > 0) {
    preMarkupMaterials = pkgData.preMarkup;
    preMarkupSource = "package";
  } else if (planMaterials.length > 0) {
    preMarkupMaterials = planMaterials;
    preMarkupSource = "plan markup";
  } else if (preMarkup) {
    const lump = parseInt(preMarkup);
    if (lump) {
      preMarkupMaterials = [{
        label: "Materials from plan markup",
        quantity: 1,
        unit: "lot",
        unitCost: lump,
        totalCost: lump,
      }];
      preMarkupSource = "plan markup";
    }
  }

  // Bundle materials merge in only if nothing else filled the slot
  if (bundleData.materials.length > 0 && preMarkupMaterials.length === 0) {
    preMarkupMaterials = bundleData.materials;
    preMarkupSource = "material bundle";
  }

  /* ── 6. Load materials (cached, single query — no loop) ── */
  let materials: { item_key: string; label: string; unit_cost: number }[] = [];

  if (effectiveTrade) {
    // Try price_book_items first (single query, cached)
    const pbItems = await getCachedPriceBook(businessId, effectiveTrade);
    if (pbItems.length > 0) {
      materials = pbItems.map((m) => ({
        item_key: m.id,
        label: m.description,
        unit_cost: m.cost_price ?? 0,
      }));
    }

    // Fallback to legacy material_items (cached)
    if (materials.length === 0) {
      const legacyItems = await getCachedLegacyMaterials(businessId, effectiveTrade);
      if (legacyItems.length > 0) {
        materials = legacyItems;
      }
    }

    // Fallback to hardcoded defaults
    if (materials.length === 0 && DEDICATED.includes(effectiveTrade)) {
      const defaults = DEDICATED_DEFAULTS[effectiveTrade];
      if (defaults) materials = defaults.map((m) => ({ ...m }));
    }
  }

  /* ── 7. Build tier objects for the builder ── */
  const resolvedPricingTiers = pricingTiers.length > 0
    ? pricingTiers
    : DEFAULT_PRICING_TIERS.map((t, i) => ({ ...t, id: `default-pt-${i}` }));

  const resolvedJobSizeTiers = jobSizeTiers.length > 0
    ? jobSizeTiers
    : DEFAULT_JOB_SIZE_TIERS.map((t, i) => ({ ...t, id: `default-jst-${i}` }));

  const profile = {
    hourly_rate: dbProfile.hourly_rate ?? 95,
    materials_margin_pct: dbProfile.materials_margin_pct ?? 20,
    trades: dbProfile.trades,
    onboarded_at: dbProfile.onboarded_at,
  };

  return (
    <>
      <AppHeader />
      {activeTrades.length > 1 && (
        <div className="bg-[var(--surface)] border-b border-[var(--line)]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <span className="text-[12px] font-bold text-[var(--ink-faint)] uppercase tracking-wide mr-1 shrink-0">
              Trade:
            </span>
            {activeTrades.map((t: string) => {
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

      <QuoteBuilderDynamic
        tradeKey={selectedTrade}
        profile={profile}
        materials={materials}
        preClientId={preClientId}
        preMarkupMaterials={preMarkupMaterials}
        preMarkupSource={preMarkupSource}
        pricingTiers={resolvedPricingTiers}
        jobSizeTiers={resolvedJobSizeTiers}
      />
    </>
  );
}
