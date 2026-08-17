"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import { Loader2 } from "lucide-react";
import { normalizeTradeValue } from "@/lib/genericTrades";

/* One raise-quote surface for every trade. Dedicated calc engines live as
   an optional Estimate assistant inside GenericQuoteBuilder that dumps
   into the same siteItems scope as packages, drawings, and materials. */
function BuilderLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <Loader2 size={22} className="animate-spin text-[var(--navy)]" />
      <p className="text-[13px] text-[var(--ink-faint)]">Loading quote builder...</p>
    </div>
  );
}

const GenericQuoteBuilder = dynamic(() => import("./GenericQuoteBuilder"), {
  ssr: false,
  loading: BuilderLoading,
});

interface BuilderProps {
  tradeKey: string;
  profile: { hourly_rate: number; materials_margin_pct: number; trades: string[] | null; onboarded_at: string | null };
  materials: { item_key: string; label: string; unit_cost: number }[];
  preClientId?: string;
  preMarkupMaterials?: Array<{ label: string; quantity: number; unit: string; unitCost: number; totalCost: number; labourHrs?: number }>;
  preMarkupSource?: "package" | "plan markup" | "material bundle";
  pricingTiers: Array<{ id: string; name: string; markup_pct: number; sort_order: number }>;
  jobSizeTiers: Array<{ id: string; name: string; max_days: number | null; markup_pct: number; sort_order: number }>;
  siteConditions: Array<{ id: string; trade: string; label: string; kind: "fixed" | "daily"; default_amount: number; sort_order: number }>;
  teamMembers: Array<{ id: string; name: string | null; email: string }>;
}

function TradeBuilderInner({ tradeKey, profile, ...rest }: BuilderProps) {
  const key = normalizeTradeValue(tradeKey) ?? tradeKey;
  return <GenericQuoteBuilder tradeKey={key} profile={profile} {...rest} />;
}

export default memo(TradeBuilderInner);
