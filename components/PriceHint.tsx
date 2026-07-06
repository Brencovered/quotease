"use client";

/**
 * PriceHint
 * ---------
 * Sits directly under a quote-wizard field (a counter, a checkbox) and shows
 * *right there* what real product it's priced from and what that line will
 * cost -- instead of the tradie having to trust an abstract number and find
 * out at the very end (or in a separate Materials tab) whether it means
 * anything. Tapping "Link"/"Change" opens the price-book picker inline, no
 * navigation away from the job.
 *
 * Only rendered once a real price book exists for the trade -- before that,
 * the built-in default price *is* the number, so there's nothing to show.
 */

import { useState } from "react";
import { Check, BookOpen } from "lucide-react";
import CategoryMaterialPicker, { type PickerItem } from "@/components/CategoryMaterialPicker";

export default function PriceHint({
  trade,
  calcKey,
  calcLabel,
  qty,
  price,
  isLinked,
  lib,
  onLink,
}: {
  trade: string;
  calcKey: string;
  calcLabel: string;
  /** Quantity this line applies to (1 for a flat fee/checkbox). */
  qty: number;
  /** The resolved unit price (real product if linked, else built-in default). */
  price: number;
  isLinked: boolean;
  lib: PickerItem[];
  onLink: (itemKey: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  if (qty <= 0) return null;

  const subtotal = Math.round(qty * price);

  return (
    <div className="flex items-center justify-between gap-2 mt-1 px-0.5">
      <button
        onClick={() => setPicking(true)}
        className={`inline-flex items-center gap-1 text-[11.5px] font-semibold truncate ${
          isLinked ? "text-[var(--green)]" : "text-[var(--amber-deep)]"
        }`}
      >
        {isLinked ? <Check size={11} className="shrink-0" /> : <BookOpen size={11} className="shrink-0" />}
        <span className="truncate">
          {isLinked ? `$${price.toLocaleString()} ea` : `Est. $${price.toLocaleString()} ea — link`}
        </span>
      </button>
      <span className="text-[11.5px] font-bold text-[var(--ink-faint)] shrink-0 tabular">
        = ${subtotal.toLocaleString()}
      </span>

      {picking && (
        <CategoryMaterialPicker
          trade={trade}
          archetypeKey={calcKey}
          archetypeLabel={calcLabel}
          lib={lib}
          onSelect={(item: PickerItem) => { onLink(item.item_key); setPicking(false); }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
