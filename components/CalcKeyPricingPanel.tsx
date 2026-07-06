"use client";

/**
 * CalcKeyPricingPanel
 * --------------------
 * Lists every generic cost key a trade's structured-intake calculator uses
 * (e.g. plumber's "basin_tap", "toilet_suite") and lets the tradie link each
 * one to a real product from their uploaded price book. Mirrors the AI
 * drawing-analysis review flow: pick once, remembered forever via
 * profiles.archetype_defaults["<trade>:calc:<key>"].
 *
 * Only rendered once a real price book has been detected for the trade --
 * before that, the built-in default prices (editable via the existing
 * Materials tab) are the only sensible source of truth.
 */

import { useMemo, useState } from "react";
import { BookOpen, Check, RotateCcw } from "lucide-react";
import CategoryMaterialPicker, { type PickerItem } from "@/components/CategoryMaterialPicker";
import { findCategory } from "@/lib/archetypeCategories";
import { resolveCalcCosts, type CalcMaterialRow } from "@/lib/resolveCalcCosts";

export default function CalcKeyPricingPanel({
  trade,
  defaults,
  lib,
  archetypeDefaults,
  onSaveDefault,
}: {
  trade: string;
  defaults: readonly CalcMaterialRow[];
  lib: CalcMaterialRow[];
  archetypeDefaults: Record<string, string>;
  onSaveDefault: (calcKey: string, itemKey: string) => void;
}) {
  const [pickerKey, setPickerKey] = useState<string | null>(null);

  const resolved = useMemo(
    () => resolveCalcCosts(trade, defaults, lib, archetypeDefaults),
    [trade, defaults, lib, archetypeDefaults]
  );

  function rowFor(key: string) {
    const linkedItemKey = archetypeDefaults[`${trade}:calc:${key}`];
    const product = linkedItemKey ? lib.find((r) => r.item_key === linkedItemKey) ?? null : null;
    return { product, price: resolved[key] ?? 0 };
  }

  function pick(item: PickerItem) {
    if (!pickerKey) return;
    onSaveDefault(pickerKey, item.item_key);
    setPickerKey(null);
  }

  const pickerCategory = pickerKey ? findCategory(trade, pickerKey) : null;
  const pickerDefault  = pickerKey ? defaults.find((d) => d.item_key === pickerKey) : null;

  return (
    <div>
      <div className="bg-[var(--amber-light)] border border-[var(--amber)]/30 rounded-xl px-4 py-3 mb-4">
        <p className="text-[13.5px] font-bold text-[var(--amber-deep)] mb-1">Link to your price book</p>
        <p className="text-[13px] text-[var(--amber-deep)]/80 leading-snug">
          Your quotes use these standard job items. Link each one to the real product you
          actually buy so quotes price off your real supplier cost, not a generic estimate.
          Unlinked items still work but use a built-in default price.
        </p>
      </div>

      <div className="border border-[var(--line)] rounded-2xl overflow-hidden divide-y divide-[var(--line-subtle)]">
        {defaults.map((d) => {
          const { product, price } = rowFor(d.item_key);
          return (
            <div key={d.item_key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-[var(--ink)] truncate">{d.label}</p>
                {product ? (
                  <p className="text-[12px] text-[var(--green)] font-semibold truncate flex items-center gap-1">
                    <Check size={12} /> {product.label}
                  </p>
                ) : (
                  <p className="text-[12px] text-[var(--ink-faint)]">Using default estimate</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[13.5px] font-bold text-[var(--ink)] tabular">
                  ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <button
                  onClick={() => setPickerKey(d.item_key)}
                  className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--navy)] border border-[var(--navy)]/30 rounded-lg px-2.5 py-1.5 hover:bg-[var(--navy)]/5"
                >
                  <BookOpen size={12} /> {product ? "Change" : "Link"}
                </button>
                {product && (
                  <button
                    onClick={() => onSaveDefault(d.item_key, "")}
                    title="Reset to default estimate"
                    className="text-[var(--ink-faint)] hover:text-[var(--red)] p-1.5"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pickerKey && pickerCategory && (
        <CategoryMaterialPicker
          trade={trade}
          archetypeKey={pickerKey}
          archetypeLabel={pickerDefault?.label ?? pickerCategory.label}
          lib={lib}
          onSelect={pick}
          onClose={() => setPickerKey(null)}
        />
      )}
    </div>
  );
}
