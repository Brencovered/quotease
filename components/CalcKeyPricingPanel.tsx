"use client";

/**
 * CalcKeyPricingPanel
 * --------------------
 * Lists every generic cost key a trade's structured-intake calculator uses
 * (e.g. plumber's "basin_tap", "toilet_suite") and lets the tradie link each
 * one to one or more real products from their uploaded price book (e.g. a
 * "Power point" line might be a GPO + a cover plate). Mirrors the AI
 * drawing-analysis review flow: pick once, remembered forever via
 * profiles.archetype_defaults["<trade>:calc:<key>"] (stored as a JSON array
 * of item_keys so more than one product can back a single line).
 *
 * Only rendered once a real price book has been detected for the trade --
 * before that, the built-in default prices (editable via the existing
 * Materials tab) are the only sensible source of truth.
 */

import { useMemo, useState } from "react";
import { BookOpen, Check, Plus, X } from "lucide-react";
import CategoryMaterialPicker, { type PickerItem } from "@/components/CategoryMaterialPicker";
import { findCategory } from "@/lib/archetypeCategories";
import { resolveCalcCosts, parseLinkedItemKeys, type CalcMaterialRow } from "@/lib/resolveCalcCosts";

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
  onSaveDefault: (calcKey: string, itemKeys: string[]) => void;
}) {
  const [pickerKey, setPickerKey] = useState<string | null>(null);

  const resolved = useMemo(
    () => resolveCalcCosts(trade, defaults, lib, archetypeDefaults),
    [trade, defaults, lib, archetypeDefaults]
  );

  function rowFor(key: string) {
    const linkedKeys = parseLinkedItemKeys(archetypeDefaults[`${trade}:calc:${key}`]);
    const products = linkedKeys
      .map((k) => lib.find((r) => r.item_key === k))
      .filter((p): p is CalcMaterialRow => !!p);
    return { products, price: resolved[key] ?? 0 };
  }

  function addProduct(item: PickerItem) {
    if (!pickerKey) return;
    const existing = parseLinkedItemKeys(archetypeDefaults[`${trade}:calc:${pickerKey}`]);
    onSaveDefault(pickerKey, [...existing, item.item_key]);
    setPickerKey(null);
  }

  function removeProduct(key: string, itemKey: string) {
    const existing = parseLinkedItemKeys(archetypeDefaults[`${trade}:calc:${key}`]);
    onSaveDefault(key, existing.filter((k) => k !== itemKey));
  }

  const pickerCategory = pickerKey ? findCategory(trade, pickerKey) : null;
  const pickerDefault  = pickerKey ? defaults.find((d) => d.item_key === pickerKey) : null;

  return (
    <div>
      <div className="bg-[var(--amber-light)] border border-[var(--amber)]/30 rounded-xl px-4 py-3 mb-4">
        <p className="text-[13.5px] font-bold text-[var(--amber-deep)] mb-1">Link to your price book</p>
        <p className="text-[13px] text-[var(--amber-deep)]/80 leading-snug">
          Your quotes use these standard job items. Link each one to the real product(s) you
          actually buy so quotes price off your real supplier cost, not a generic estimate.
          You can link more than one product to a single line (e.g. a fitting plus its cover
          plate). Unlinked items still work but use a built-in default price.
        </p>
      </div>

      <div className="border border-[var(--line)] rounded-2xl overflow-hidden divide-y divide-[var(--line-subtle)]">
        {defaults.map((d) => {
          const { products, price } = rowFor(d.item_key);
          return (
            <div key={d.item_key} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <p className="text-[13.5px] font-semibold text-[var(--ink)] truncate">{d.label}</p>
                <span className="text-[13.5px] font-bold text-[var(--ink)] tabular shrink-0">
                  ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {products.length === 0 && (
                  <span className="inline-flex items-center gap-1 bg-[var(--amber-light)] text-[var(--amber-deep)] text-[11px] font-bold px-2 py-1 rounded-full">
                    Default estimate — not from your price list
                  </span>
                )}
                {products.map((p) => (
                  <span
                    key={p.item_key}
                    className="inline-flex items-center gap-1 bg-[var(--green-bg)] text-[var(--green)] text-[11px] font-bold px-2 py-1 rounded-full"
                  >
                    <Check size={10} /> {p.label}
                    <button onClick={() => removeProduct(d.item_key, p.item_key)} className="hover:text-[var(--red)]">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => setPickerKey(d.item_key)}
                  className="inline-flex items-center gap-1 bg-[var(--navy)] text-white text-[11.5px] font-bold px-2.5 py-1 rounded-full hover:bg-[#0e2233] transition-colors"
                >
                  {products.length > 0 ? <Plus size={11} /> : <BookOpen size={11} />}
                  {products.length > 0 ? "Add item" : "Link to price book"}
                </button>
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
          onSelect={addProduct}
          onClose={() => setPickerKey(null)}
        />
      )}
    </div>
  );
}
