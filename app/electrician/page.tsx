import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ trade?: string; client_id?: string; markup_materials?: string }> }) {
  const { trade: tradeParm, client_id: preClientId, markup_materials: preMarkup } = await searchParams;

  let profile: { hourly_rate: number; materials_margin_pct: number; trades?: string[]; onboarded_at?: string | null } = {
    hourly_rate: 95, materials_margin_pct: 20,
  };
  let materials: { item_key: string; label: string; unit_cost: number }[] = [];
  let activeTrades: string[] = [];
  let needsOnboarding = false;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: dbProfile } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
      if (dbProfile) {
        if (!dbProfile.onboarded_at) { needsOnboarding = true; }
        else { profile = dbProfile; activeTrades = dbProfile.trades ?? []; }
      }
      // Load materials for dedicated trade builders
      if (tradeParm && DEDICATED.includes(tradeParm)) {
        const tradeMats = await supabase.from("material_items").select("*").eq("profile_id", userData.user.id).eq("trade", tradeParm).order("label");
        if (tradeMats.data && tradeMats.data.length > 0) materials = tradeMats.data;
        if (materials.length === 0) {
          const defaults = DEDICATED_DEFAULTS[tradeParm];
          if (defaults) materials = defaults.map((m) => ({ ...m }));
        }
      }
    }
  } catch (err) {
    console.error("New quote page error:", err);
  }

  if (needsOnboarding) redirect("/onboarding");

  const selectedTrade = (tradeParm && activeTrades.includes(tradeParm)) ? tradeParm : activeTrades[0] ?? "electrician";

  return (
    <>
      <AppHeader />
      {/* Trade switcher */}
      {activeTrades.length > 1 && (
        <div className="bg-[var(--surface)] border-b border-[var(--line)]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <span className="text-[12px] font-bold text-[var(--ink-faint)] uppercase tracking-wide mr-1 shrink-0">Trade:</span>
            {activeTrades.map((t) => {
              const meta = ALL_TRADES.find((x) => x.key === t);
              return (
                <Link key={t} href={`/electrician?trade=${t}`}
                  className={`px-4 py-1.5 rounded-lg text-[13px] font-bold capitalize whitespace-nowrap border-2 transition-colors ${
                    t === selectedTrade ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"
                  }`}>
                  {meta?.label ?? t}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Route to correct builder */}
      {selectedTrade === "electrician" && <QuoteBuilder profile={profile} materials={materials} preClientId={preClientId} preMarkupMaterials={preMarkup ? parseInt(preMarkup) : undefined} />}
      {selectedTrade === "plumber"     && <PlumberQuoteBuilder profile={profile} materials={materials} preClientId={preClientId} preMarkupMaterials={preMarkup ? parseInt(preMarkup) : undefined} />}
      {selectedTrade === "carpenter"   && <CarpenterQuoteBuilder profile={profile} materials={materials} preClientId={preClientId} preMarkupMaterials={preMarkup ? parseInt(preMarkup) : undefined} />}
      {selectedTrade === "roofer"      && <RooferQuoteBuilder profile={profile} materials={materials} preClientId={preClientId} preMarkupMaterials={preMarkup ? parseInt(preMarkup) : undefined} />}
      {!DEDICATED.includes(selectedTrade) && (
        <GenericQuoteBuilder tradeKey={selectedTrade} profile={profile} preClientId={preClientId} preMarkupMaterials={preMarkup ? parseInt(preMarkup) : undefined} />
      )}
    </>
  );
}
