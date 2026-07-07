"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Trash2 } from "lucide-react";

export type ScopeItem = {
  id: string;
  label: string;
  qty: number;
  unit: string;
  note: string;
  materialsCost: number; // TOTAL line cost (qty * unit cost), not per-unit
  labourHrs: number;     // TOTAL hours for this line, not per-unit
};

type MaterialRow = { item_key: string; label: string; unit_cost: number };

/**
 * Search-and-add over the tradie's own materials/price book (the `lib`
 * array already loaded client-side in each builder - no API round trip
 * needed). This is the manual-build path: if a tradie hasn't used plan
 * markup, voice, live annotate, or drawing extract, this is how they
 * build a quote instead of a fixed form of specific counters.
 */
export function MaterialSearchAdd({ lib, onAdd }: { lib: MaterialRow[]; onAdd: (item: Omit<ScopeItem, "id">) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return lib.filter((m) => m.label.toLowerCase().includes(q)).slice(0, 8);
  }, [query, lib]);

  function add(m: MaterialRow) {
    onAdd({ label: m.label, qty: 1, unit: "ea", note: "", materialsCost: m.unit_cost, labourHrs: 0 });
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search your materials to add an item..."
          className="app-field pl-9"
        />
      </div>
      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-[12.5px] text-[var(--ink-faint)] px-3 py-3">No matches in your price book. Try a different search, or add a custom item below.</p>
          ) : (
            results.map((m) => (
              <button
                key={m.item_key}
                type="button"
                onClick={() => add(m)}
                className="w-full flex items-center justify-between text-left px-3 py-2.5 hover:bg-[var(--app-bg)] border-b border-[var(--line)] last:border-0"
              >
                <span className="text-[13px] text-[var(--ink)] truncate pr-2">{m.label}</span>
                <span className="text-[12.5px] font-semibold text-[var(--ink-faint)] whitespace-nowrap">${m.unit_cost.toLocaleString()}</span>
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => { onAdd({ label: query.trim(), qty: 1, unit: "ea", note: "", materialsCost: 0, labourHrs: 0 }); setQuery(""); setOpen(false); }}
            className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-[12.5px] font-semibold text-[var(--amber-deep)] hover:bg-[var(--app-bg)]"
          >
            <Plus size={13} /> Add &quot;{query.trim()}&quot; as a custom item
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Editable list of scope items - materials/labour that arrived here
 * either from a generator (drawing takeoff, live annotate, voice, a
 * package) or from manually searching and adding above. Same list,
 * same editing UI, regardless of where an item came from.
 */
export function ScopeItemsList({ items, setItems }: {
  items: ScopeItem[];
  setItems: React.Dispatch<React.SetStateAction<ScopeItem[]>>;
}) {
  function update(id: string, patch: Partial<ScopeItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  if (items.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--ink-faint)] py-3 text-center border border-dashed border-[var(--line)] rounded-xl">
        No items yet. Search above to add materials, or use plan markup / voice / drawing extract on the Files step.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const unitCost = item.qty > 0 ? item.materialsCost / item.qty : item.materialsCost;
        return (
          <div key={item.id} className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3 py-2.5">
            <input
              value={item.label}
              onChange={(e) => update(item.id, { label: e.target.value })}
              className="flex-1 min-w-0 bg-transparent text-[13.5px] font-medium text-[var(--ink)] focus:outline-none"
            />
            <input
              type="number"
              value={item.qty}
              onChange={(e) => {
                const qty = Math.max(0, Number(e.target.value) || 0);
                update(item.id, { qty, materialsCost: Math.round(unitCost * qty * 100) / 100 });
              }}
              className="w-14 bg-[var(--app-bg)] rounded-lg text-center text-[13px] py-1"
              title="Quantity"
            />
            <span className="text-[11px] text-[var(--ink-faint)] w-8">{item.unit}</span>
            <div className="flex items-center gap-1 w-24">
              <span className="text-[12px] text-[var(--ink-faint)]">$</span>
              <input
                type="number"
                value={unitCost || 0}
                onChange={(e) => {
                  const newUnitCost = Math.max(0, Number(e.target.value) || 0);
                  update(item.id, { materialsCost: Math.round(newUnitCost * item.qty * 100) / 100 });
                }}
                className="w-full bg-[var(--app-bg)] rounded-lg text-center text-[13px] py-1"
                title="Unit cost"
              />
            </div>
            <div className="flex items-center gap-1 w-20">
              <input
                type="number"
                step="0.25"
                value={item.labourHrs || 0}
                onChange={(e) => update(item.id, { labourHrs: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full bg-[var(--app-bg)] rounded-lg text-center text-[13px] py-1"
                title="Labour hours"
              />
              <span className="text-[11px] text-[var(--ink-faint)]">hrs</span>
            </div>
            <span className="text-[13px] font-semibold text-[var(--ink)] w-16 text-right">${item.materialsCost.toLocaleString()}</span>
            <button type="button" onClick={() => remove(item.id)} className="text-[var(--ink-faint)] hover:text-[var(--red)] p-1">
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
