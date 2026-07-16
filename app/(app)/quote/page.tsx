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
import { getPeripheralsForBusiness } from "@/lib/peripherals";

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

/**
 * Price book first (real supplier pricing), legacy material_items as
 * fallback, hardcoded defaults as last resort. Pulled out into its own
 * function so it can be kicked off eagerly alongside the main Promise.all
 * in the common case where no package/bundle is in play (see below) rather
 * than always waiting until after effectiveTrade is resolved.
 */
async function resolveMaterialsForTrade(
  businessId: string,
  trade: string | undefined
): Promise<{ item_key: string; label: string; unit_cost: number }[]> {
  if (!trade) return [];

  const pbItems = await getCachedPriceBook(businessId, trade);
  if (pbItems.length > 0) {
    return pbItems.map((m) => ({ item_key: m.id, label: m.description, unit_cost: m.cost_price ?? 0 }));
  }

  const legacyItems = await getCachedLegacyMaterials(businessId, trade);
  if (legacyItems.length > 0) return legacyItems;

  if (DEDICATED.includes(trade)) {
    const defaults = DEDICATED_DEFAULTS[trade];
    if (defaults) return defaults.map((m) => ({ ...m }));
  }

  return [];
}

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

  // Only a package or bundle can override the trade away from
  // selectedTrade (see step 4 below). That only happens when the request
  // actually carries a package_id/bundle_id - the overwhelming majority of
  // visits to this page don't. In that common case effectiveTrade is
  // already known to equal selectedTrade before any query runs, so site
  // conditions and materials (previously two more sequential stages after
  // this Promise.all) can be kicked off right now instead of waiting.
  const packageOrBundleRequested = Boolean(packageId || bundleId);
  const eagerSiteConditionsPromise = packageOrBundleRequested
    ? null
    : getPeripheralsForBusiness(supabase, businessId, selectedTrade);
  const eagerMaterialsPromise = packageOrBundleRequested
    ? null
    : resolveMaterialsForTrade(businessId, selectedTrade);

  /* ── 3. Fetch EVERYTHING in parallel ── */
  const [
    pricingTiers,
    jobSizeTiers,
    pkgData,
    bundleData,
    planMaterials,
    { data: teamMemberRows },
    eagerSiteConditions,
    eagerMaterials,
  ] = await Promise.all([
    getCachedPricingTiers(businessId),
    getCachedJobSizeTiers(businessId),
    loadPackage(supabase, businessId, packageId, tradeParm),
    loadBundle(supabase, businessId, bundleId, tradeParm),
    loadPlanMarkup(supabase, businessId, planId),
    supabase.from("team_members").select("id, name, email").eq("owner_profile_id", businessId).eq("status", "active").order("name"),
    eagerSiteConditionsPromise ?? Promise.resolve(null),
    eagerMaterialsPromise ?? Promise.resolve(null),
  ]);
  const teamMembers: Array<{ id: string; name: string | null; email: string }> = teamMemberRows ?? [];

  /* ── 4. Resolve trade from package/bundle ── */
  let effectiveTrade = selectedTrade;
  if (pkgData?.trade) effectiveTrade = pkgData.trade;
  if (bundleData.trade) effectiveTrade = bundleData.trade;

  // Business + trade customizable site conditions (Level 2 connection
  // fees, scaffolding, etc) - seeds from lib/peripherals.ts's hardcoded
  // defaults on first use, then reads from the business's own saved rows
  // from then on. Falls back to fetching now only in the rare case a
  // package/bundle actually changed the trade out from under the eager fetch.
  const siteConditions = eagerSiteConditions ?? (await getPeripheralsForBusiness(supabase, businessId, effectiveTrade));

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
  // Reuse the eagerly-fetched materials whenever the trade wasn't
  // overridden by a package/bundle; only re-fetch for the rare case where
  // effectiveTrade actually changed after the eager fetch was kicked off.
  const materials: { item_key: string; label: string; unit_cost: number }[] =
    eagerMaterials && effectiveTrade === selectedTrade
      ? eagerMaterials
      : await resolveMaterialsForTrade(businessId, effectiveTrade);

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
                  href={`/quote?trade=${t}`}
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
            <div className="w-2 shrink-0" aria-hidden="true" />
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
        siteConditions={siteConditions}
        teamMembers={teamMembers}
      />
    </>
  );
}
