"use client";

import { useMemo } from "react";
import { peripheralsForTrade, type PeripheralTemplate } from "@/lib/peripherals";
import type { ScopeItem } from "@/components/ScopeOfWorkStep";

/**
 * Trade-specific site conditions as toggle cards. Toggling one on adds an
 * editable line to the same "Materials & labour" list every other channel
 * feeds (qty/unit-cost/hours all editable there already) - toggling off
 * removes exactly that line. Matched by `peripheralKey`, not by label or
 * note, so a person renaming the line or editing its amount doesn't break
 * the toggle's ability to find and remove it again.
 */
export default function PeripheralsPanel({
  trade,
  siteItems,
  setSiteItems,
}: {
  trade: string;
  siteItems: ScopeItem[];
  setSiteItems: React.Dispatch<React.SetStateAction<ScopeItem[]>>;
}) {
  const templates = useMemo(() => peripheralsForTrade(trade), [trade]);

  function activeItem(key: string) {
    return siteItems.find((i) => i.peripheralKey === key);
  }

  function toggle(t: PeripheralTemplate) {
    const existing = activeItem(t.key);
    if (existing) {
      setSiteItems((prev) => prev.filter((i) => i.id !== existing.id));
      return;
    }
    setSiteItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        label: t.label,
        qty: 1,
        unit: t.kind === "daily" ? "day" : "ea",
        note: "Site condition",
        materialsCost: t.defaultAmount,
        labourHrs: 0,
        source: "extra",
        peripheralKey: t.key,
      },
    ]);
  }

  if (templates.length === 0) return null;

  return (
    <div className="card">
      <p className="section-tag mb-1">Site conditions</p>
      <p className="text-[13px] text-[var(--ink-faint)] mb-3">
        Toggle anything that applies to this job - each one adds an editable line below, so the fee or day-rate can be adjusted for this quote.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((t) => {
          const active = !!activeItem(t.key);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => toggle(t)}
              className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                active
                  ? "bg-[var(--navy)] border-[var(--navy)] text-white"
                  : "bg-[var(--app-bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--navy)]"
              }`}
            >
              <p className="text-[12.5px] font-bold leading-tight">{t.label}</p>
              <p className={`text-[11px] ${active ? "text-[var(--steel-3)]" : "text-[var(--ink-faint)]"}`}>
                {t.kind === "daily" ? `$${t.defaultAmount}/day` : `$${t.defaultAmount} flat fee`}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
