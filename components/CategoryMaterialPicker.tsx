"use client";

/**
 * CategoryMaterialPicker
 * ----------------------
 * A searchable dropdown over the tradie's REAL price book, pre-filtered to
 * the archetype's category (e.g. "Downlight" shows only downlight products).
 * Typing in the search box widens to the whole price book so keyword guesses
 * never trap the tradie. Selecting an item reports it upward; the caller is
 * responsible for remembering it as the category default.
 */

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { findCategory, filterToCategory } from "@/lib/archetypeCategories";

export interface PickerItem {
  item_key: string;
  label: string;
  unit_cost: number;
}

export default function CategoryMaterialPicker({
  trade,
  archetypeKey,
  archetypeLabel,
  lib,
  onSelect,
  onClose,
}: {
  trade: string;
  archetypeKey: string;
  archetypeLabel: string;
  lib: PickerItem[];
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const category = useMemo(() => findCategory(trade, archetypeKey), [trade, archetypeKey]);

  const filtered = useMemo(
    () => filterToCategory(lib, category, search).slice(0, 60),
    [lib, category, search]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--surface)] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <p className="font-bold text-[15px] text-[var(--ink)]">Choose {archetypeLabel.toLowerCase()}</p>
            <p className="text-[11.5px] text-[var(--ink-faint)]">
              From your price book · remembered as your default
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--ink-faint)] hover:text-[var(--ink)] p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 bg-[var(--app-bg)] border border-[var(--line)] rounded-xl px-3 py-2">
            <Search size={14} className="text-[var(--ink-faint)] shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${search ? "whole price book" : archetypeLabel.toLowerCase() + "s"}...`}
              className="bg-transparent outline-none text-[14px] flex-1 text-[var(--ink)]"
            />
          </div>
          {search && (
            <p className="text-[10.5px] text-[var(--ink-faint)] mt-1">Searching your whole price book</p>
          )}
        </div>

        <div className="overflow-y-auto flex-1 px-2 pb-4">
          {filtered.length === 0 && (
            <p className="text-[12.5px] text-[var(--ink-faint)] text-center py-6">
              {search
                ? "No items match that search."
                : `No ${archetypeLabel.toLowerCase()} items found in your price book — try searching, or add one in Materials.`}
            </p>
          )}
          {filtered.map((item) => (
            <button
              key={item.item_key}
              onClick={() => onSelect(item)}
              className="w-full flex items-center justify-between gap-3 text-left px-3 py-2.5 rounded-xl hover:bg-[var(--app-bg)]"
            >
              <span className="text-[13px] text-[var(--ink)] leading-snug">{item.label}</span>
              <span className="text-[13px] font-bold text-[var(--ink)] shrink-0 tabular">
                ${Number(item.unit_cost).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
