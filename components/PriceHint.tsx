"use client";

/**
 * PriceHint
 * ---------
 * Sits directly under a quote-wizard field (a counter, a checkbox) and shows
 * *right there* what real product(s) it's priced from and what that line
 * will cost -- instead of the tradie having to trust an abstract number and
 * find out at the very end (or in a separate Materials tab) whether it
 * means anything. A line can be backed by more than one real product (e.g.
 * "Power point" = a GPO + a cover plate) -- their costs are summed.
 *
 * Only rendered once a real price book exists for the trade -- before that,
 * the built-in default price *is* the number, so there's nothing to show.
 */

import { useState } from "react";
import { Check, BookOpen, Plus, X } from "lucide-react";
import CategoryMaterialPicker, { type PickerItem } from "@/components/CategoryMaterialPicker";
import { parseLinkedItemKeys } from "@/lib/resolveCalcCosts";

export default function PriceHint({
  trade,
  calcKey,
  calcLabel,
  qty,
  price,
  linkedRaw,
  lib,
  onLink,
}: {
  trade: string;
  calcKey: string;
  calcLabel: string;
  /** Quantity this line applies to (1 for a flat fee/checkbox). */
  qty: number;
  /** The resolved unit price (sum of linked real products, or built-in default). */
  price: number;
  /** Raw stored value from profiles.archetype_defaults for this calc key. */
  linkedRaw: string | undefined;
  lib: PickerItem[];
  /** Called with the full new set of linked item_keys (add or remove). */
  onLink: (itemKeys: string[]) => void;
}) {
  const [picking, setPicking] = useState(false);
  if (qty <= 0) return null;

  const linkedKeys = parseLinkedItemKeys(linkedRaw);
  const linkedProducts = linkedKeys
    .map((k) => lib.find((r) => r.item_key === k))
    .filter((p): p is PickerItem => !!p);
  const isLinked = linkedProducts.length > 0;
  const subtotal = Math.round(qty * price);

  function addProduct(item: PickerItem) {
    onLink([...linkedKeys, item.item_key]);
    setPicking(false);
  }
  function removeProduct(itemKey: string) {
    onLink(linkedKeys.filter((k) => k !== itemKey));
  }

  return (
    <div className="mt-1.5 px-0.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isLinked ? (
            linkedProducts.map((p) => (
              <span
                key={p.item_key}
                className="inline-flex items-center gap-1 bg-[var(--green-bg)] text-[var(--green)] text-[11px] font-bold px-2 py-1 rounded-full"
              >
                <Check size={10} /> {p.label}
                <button onClick={() => removeProduct(p.item_key)} className="hover:text-[var(--red)]">
                  <X size={10} />
                </button>
              </span>
            ))
          ) : (
            <span className="inline-flex items-center gap-1 bg-[var(--amber-light)] text-[var(--amber-deep)] text-[11px] font-bold px-2 py-1 rounded-full">
              Default estimate — not from your price list
            </span>
          )}
          <button
            onClick={() => setPicking(true)}
            className="inline-flex items-center gap-1 bg-[var(--navy)] text-white text-[11.5px] font-bold px-2.5 py-1 rounded-full hover:bg-[#0e2233] transition-colors"
          >
            {isLinked ? <Plus size={11} /> : <BookOpen size={11} />}
            {isLinked ? "Add item" : "Link to price book"}
          </button>
        </div>
        <span className="text-[12px] font-bold text-[var(--ink)] shrink-0 tabular">
          {qty}× ${price.toLocaleString()} = ${subtotal.toLocaleString()}
        </span>
      </div>

      {picking && (
        <CategoryMaterialPicker
          trade={trade}
          archetypeKey={calcKey}
          archetypeLabel={calcLabel}
          lib={lib}
          onSelect={addProduct}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
