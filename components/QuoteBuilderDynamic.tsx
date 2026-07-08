"use client";

import dynamic from "next/dynamic";
import { memo } from "react";

/* Lazy-load the heavy quote builders so the page shell renders instantly
   while the builder chunks download in the background.                */

const QuoteBuilder        = dynamic(() => import("./QuoteBuilder"),        { ssr: false });
const PlumberQuoteBuilder = dynamic(() => import("./PlumberQuoteBuilder"), { ssr: false });
const CarpenterQuoteBuilder = dynamic(() => import("./CarpenterQuoteBuilder"), { ssr: false });
const RooferQuoteBuilder  = dynamic(() => import("./RooferQuoteBuilder"),   { ssr: false });
const GenericQuoteBuilder = dynamic(() => import("./GenericQuoteBuilder"),  { ssr: false });

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
