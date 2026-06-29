"use client";

import { useState } from "react";
import Link from "next/link";
import { Wrench, BookOpen, Package } from "lucide-react";
import MaterialPricingPanel from "@/components/MaterialPricingPanel";
import PriceBookPanel from "@/components/PriceBookPanel";
import PackagesPanel from "@/components/PackagesPanel";

interface PriceBookItem { id: string; supplier: string; sku: string | null; description: string; unit: string; cost_price: number; trade: string | null; imported_at: string }
interface JobPackage { id: string; trade: string; name: string; description: string | null; items: { item_key: string; label: string; qty: number; unit_cost: number }[]; labour_hours: number }
interface MaterialRow { item_key: string; label: string; unit_cost: number; trade: string }

type Tab = "materials" | "pricebook" | "packages";

export default function MaterialsPricingTabs({
  trades, hourlyRate, marginPct, priceBookItems, supplierCounts, packages, allMaterials,
}: {
  trades: string[];
  hourlyRate: number;
  marginPct: number;
  priceBookItems: PriceBookItem[];
  supplierCounts: Record<string, number>;
  packages: JobPackage[];
  allMaterials: MaterialRow[];
}) {
  const [tab, setTab] = useState<Tab>("materials");

  const TABS: { id: Tab; label: string; icon: typeof Wrench; count: number }[] = [
    { id: "materials", label: "Materials",  icon: Wrench,    count: allMaterials.length },
    { id: "pricebook", label: "Price Book", icon: BookOpen,  count: priceBookItems.length },
    { id: "packages",  label: "Packages",   icon: Package,   count: packages.length },
  ];

  return (
    <div>
      {/* Rate + margin summary */}
      <div className="card mb-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] mb-1">Your hourly rate</p>
          <p className="font-display text-[28px] text-[var(--ink)] leading-none">${hourlyRate}<span className="text-[16px] text-[var(--ink-faint)]">/hr</span></p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] mb-1">Materials margin</p>
          <p className="font-display text-[28px] text-[var(--ink)] leading-none">{marginPct}%</p>
        </div>
        <p className="col-span-2 text-[12.5px] text-[var(--ink-faint)]">
          Change these in <Link href="/settings" className="underline">Settings</Link>. They apply to every new quote.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 border-b border-[var(--line)] -mt-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[13.5px] font-bold border-b-2 -mb-px transition-colors ${
              tab === t.id ? "border-[var(--amber-deep)] text-[var(--ink)]" : "border-transparent text-[var(--ink-faint)] hover:text-[var(--ink-soft)]"
            }`}
          >
            <t.icon size={15} />
            {t.label}
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-[var(--amber-light)] text-[var(--amber-deep)]" : "bg-[var(--app-bg)] text-[var(--ink-faint)]"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "materials" && (
        <div>
          <p className="text-[13px] text-[var(--ink-faint)] mb-4">
            Your standard rate for each item, by trade. This is what every quote calculates from by default.
          </p>
          <MaterialPricingPanel trades={trades} />
        </div>
      )}

      {tab === "pricebook" && (
        <div>
          <p className="text-[13px] text-[var(--ink-faint)] mb-4">
            Import supplier price lists for SKU-level pricing. Search these when building a quote or a package for exact supplier costs.
          </p>
          <PriceBookPanel items={priceBookItems} supplierCounts={supplierCounts} />
        </div>
      )}

      {tab === "packages" && (
        <div>
          <p className="text-[13px] text-[var(--ink-faint)] mb-4">
            Bundle materials and labour for jobs you quote often. Pull items straight from your materials list or price book —
            no need to retype names or costs.
          </p>
          <PackagesPanel trades={trades} initialPackages={packages} allMaterials={allMaterials} hourlyRate={hourlyRate} />
        </div>
      )}
    </div>
  );
}
