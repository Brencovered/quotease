"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import { Loader2 } from "lucide-react";

/* Lazy-load the heavy quote builders so the page shell renders instantly
   while the builder chunks download in the background. `ssr:false` means
   these render nothing on the server - without a `loading` fallback,
   nothing paints at all client-side either until the whole builder chunk
   has downloaded, parsed, and executed. That's a very plausible driver of
   this route's real-world FCP (7.23s per Speed Insights): the page shell
   is blank until a genuinely large bundle finishes loading. A lightweight
   spinner here counts as a paint the moment the page shell mounts,
   instead of the browser having nothing to show for several seconds. */
function BuilderLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <Loader2 size={22} className="animate-spin text-[var(--navy)]" />
      <p className="text-[13px] text-[var(--ink-faint)]">Loading quote builder...</p>
    </div>
  );
}

const QuoteBuilder        = dynamic(() => import("./QuoteBuilder"),        { ssr: false, loading: BuilderLoading });
const PlumberQuoteBuilder = dynamic(() => import("./PlumberQuoteBuilder"), { ssr: false, loading: BuilderLoading });
const CarpenterQuoteBuilder = dynamic(() => import("./CarpenterQuoteBuilder"), { ssr: false, loading: BuilderLoading });
const RooferQuoteBuilder  = dynamic(() => import("./RooferQuoteBuilder"),   { ssr: false, loading: BuilderLoading });
const GenericQuoteBuilder = dynamic(() => import("./GenericQuoteBuilder"),  { ssr: false, loading: BuilderLoading });

interface BuilderProps {
  tradeKey: string;
  profile: { hourly_rate: number; materials_margin_pct: number; trades: string[] | null; onboarded_at: string | null };
  materials: { item_key: string; label: string; unit_cost: number }[];
  preClientId?: string;
  preMarkupMaterials?: Array<{ label: string; quantity: number; unit: string; unitCost: number; totalCost: number; labourHrs?: number }>;
  preMarkupSource?: "package" | "plan markup" | "material bundle";
  pricingTiers: Array<{ id: string; name: string; markup_pct: number; sort_order: number }>;
  jobSizeTiers: Array<{ id: string; name: string; max_days: number | null; markup_pct: number; sort_order: number }>;
}

function TradeBuilderInner({ tradeKey, profile, ...rest }: BuilderProps) {
  // Roofer's own prop type is stricter (trades?: string[], no null) than
  // the others - normalize here rather than loosening every builder's
  // type to match Supabase's nullable array column.
  const normalizedProfile = { ...profile, trades: profile.trades ?? undefined };
  if (tradeKey === "electrician") return <QuoteBuilder profile={profile} {...rest} />;
  if (tradeKey === "plumber")     return <PlumberQuoteBuilder profile={profile} {...rest} />;
  if (tradeKey === "carpenter")   return <CarpenterQuoteBuilder profile={profile} {...rest} />;
  if (tradeKey === "roofer")      return <RooferQuoteBuilder profile={normalizedProfile} {...rest} />;
  return <GenericQuoteBuilder tradeKey={tradeKey} profile={profile} {...rest} />;
}

export default memo(TradeBuilderInner);
