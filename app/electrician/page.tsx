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
import AppHeader from "@/components/AppHeader";
import Link from "next/link";

const TRADE_DEFAULTS: Record<string, readonly { item_key: string; label: string; unit_cost: number }[]> = {
  electrician: ELECTRICIAN_DEFAULT_MATERIALS,
  plumber:     PLUMBER_DEFAULT_MATERIALS,
  carpenter:   CARPENTER_DEFAULT_MATERIALS,
  roofer:      ROOFER_DEFAULT_MATERIALS,
};

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ trade?: string }> }) {
  const { trade: tradeParm } = await searchParams;

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
        else {
          profile = dbProfile;
          activeTrades = dbProfile.trades ?? [];
        }
      }

      // Load materials for the selected trade
      const tradeMats = await supabase.from("material_items").select("*").eq("profile_id", userData.user.id).order("label");
      if (tradeMats.data && tradeMats.data.length > 0) {
        materials = tradeMats.data.filter((m: { trade: string }) => m.trade === (tradeParm ?? "electrician"));
      }
      if (materials.length === 0) {
        const defaults = TRADE_DEFAULTS[tradeParm ?? "electrician"] ?? ELECTRICIAN_DEFAULT_MATERIALS;
        materials = defaults.map((m) => ({ ...m }));
      }
    }
  } catch (err) {
    console.error("New quote page error:", err);
  }

  if (needsOnboarding) redirect("/onboarding");

  // If no trade selected yet and user has multiple trades, show picker
  const selectedTrade = tradeParm && activeTrades.includes(tradeParm) ? tradeParm : activeTrades[0] ?? "electrician";

  return (
    <>
      <AppHeader />
      {/* Trade switcher — only show if user has multiple trades */}
      {activeTrades.length > 1 && (
        <div className="bg-[var(--surface)] border-b border-[var(--line)]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <span className="text-[12px] font-bold text-[var(--ink-faint)] uppercase tracking-wide mr-1 shrink-0">Quote as:</span>
            {activeTrades.map((t) => (
              <Link key={t} href={`/electrician?trade=${t}`}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-bold capitalize whitespace-nowrap border-2 transition-colors ${
                  t === selectedTrade ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"
                }`}>
                {t === "roofer" ? "Roofer" : t.charAt(0).toUpperCase() + t.slice(1)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {selectedTrade === "plumber"   && <PlumberQuoteBuilder   profile={profile} materials={materials} />}
      {selectedTrade === "carpenter" && <CarpenterQuoteBuilder profile={profile} materials={materials} />}
      {selectedTrade === "roofer"    && <RooferQuoteBuilder    profile={profile} materials={materials} />}
      {(selectedTrade === "electrician" || !["plumber","carpenter","roofer"].includes(selectedTrade)) && (
        <QuoteBuilder profile={profile} materials={materials} />
      )}
    </>
  );
}
