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

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{
    trade?: string;
    client_id?: string;
    markup_materials?: string;
    plan_id?: string;
    package_id?: string;
  }>;
}) {
  let { trade: tradeParm } = await searchParams;
  const {
    client_id: preClientId,
    markup_materials: preMarkup,
    plan_id: planId,
    package_id: packageId,
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

      if (tradeParm && DEDICATED.includes(tradeParm)) {
        /* Try price_book_items first (CSV uploads + supplier catalog) */
        const tradeMats = await supabase
          .from("price_book_items")
          .select("id,description,cost_price")
          .eq("profile_id", businessId)
          .eq("trade", tradeParm)
          .order("description");
        if (tradeMats.data && tradeMats.data.length > 0) {
          materials = tradeMats.data.map((m) => ({
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
        />
      )}
      {selectedTrade === "plumber" && (
        <PlumberQuoteBuilder
          profile={profile}
          materials={materials}
          preClientId={preClientId}
          preMarkupMaterials={preMarkupMaterials}
        />
      )}
      {selectedTrade === "carpenter" && (
        <CarpenterQuoteBuilder
          profile={profile}
          materials={materials}
          preClientId={preClientId}
          preMarkupMaterials={preMarkupMaterials}
        />
      )}
      {selectedTrade === "roofer" && (
        <RooferQuoteBuilder
          profile={profile}
          materials={materials}
          preClientId={preClientId}
          preMarkupMaterials={preMarkupMaterials}
        />
      )}
      {!DEDICATED.includes(selectedTrade) && (
        <GenericQuoteBuilder
          tradeKey={selectedTrade}
          profile={profile}
          preClientId={preClientId}
          preMarkupMaterials={preMarkupMaterials}
        />
      )}
    </>
  );
}
