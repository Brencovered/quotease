"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Search, Plus, Trash2 } from "lucide-react";

export type ScopeItemSource =
  | "manual" | "annotation" | "drawing" | "voice"
  | "package" | "plan_markup" | "material_bundle" | "extra";

const SOURCE_LABELS: Record<ScopeItemSource, string> = {
  manual: "Manual", annotation: "Site annotation", drawing: "Drawing takeoff",
  voice: "Voice note", package: "Package", plan_markup: "Plan markup",
  material_bundle: "Material bundle", extra: "Extra",
};

export type ScopeItem = {
  id: string;
  label: string;
  qty: number;
  unit: string;
  note: string;
  materialsCost: number; // TOTAL line cost (qty * unit cost), not per-unit
  labourHrs: number;     // TOTAL hours for this line, not per-unit
  /** Which of the five entry channels created this line - shown as a
   *  small caption so a tradie can see at a glance where a number came
   *  from. Optional/undefined for older saved quotes predating this. */
  source?: ScopeItemSource;
  /** True once a person edits this line by hand after it was added.
   *  Nothing currently re-runs a channel's pricing over an existing
   *  line, so this doesn't guard against an overwrite loop today - but
   *  it's the flag the PRD's "Global Rule for All Channels" calls for,
   *  and it's what a future recalculation pass must check before ever
   *  touching a line automatically. */
  overridden?: boolean;
  /** Set only for lines created by toggling a site-peripheral card
   *  (scaffolding, roof access, etc.) - lets the peripherals panel find
   *  and remove its own line again on toggle-off without touching
   *  `note`, which is free text a person can edit and which may show up
   *  in quote/invoice output. */
  peripheralKey?: string;
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
    onAdd({ label: m.label, qty: 1, unit: "ea", note: "", materialsCost: m.unit_cost, labourHrs: 0, source: "manual" });
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
            onClick={() => { onAdd({ label: query.trim(), qty: 1, unit: "ea", note: "", materialsCost: 0, labourHrs: 0, source: "manual" }); setQuery(""); setOpen(false); }}
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
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch, overridden: true } : it)));
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
      {items.map((item) => (
        <ScopeItemRow key={item.id} item={item} update={update} remove={remove} />
      ))}
    </div>
  );
}

/**
 * A single editable row. Quantity, unit cost, and labour hours each get
 * their own local text state so the field can sit empty mid-edit (normal
 * on mobile: clear the digits, then type new ones) WITHOUT that transient
 * empty state forcing its way into the shared item data.
 *
 * The bug this fixes: unit cost isn't stored directly - it's derived as
 * materialsCost / qty for display. The old inline version recomputed
 * materialsCost = unitCost * qty on every qty keystroke, including the
 * moment the field was cleared (qty -> 0), which zeroed materialsCost
 * too. On the very next render, with qty back at 0, the derived unit
 * cost collapsed to materialsCost (now also 0) - permanently. Typing a
 * new quantity afterwards multiplied that zeroed unit cost by the new
 * qty, so the price stayed stuck at $0 no matter what you typed next.
 * unitCostRef below remembers the last genuine (qty > 0) unit cost, so
 * a momentarily-empty qty field never destroys it.
 */
function ScopeItemRow({ item, update, remove }: {
  item: ScopeItem;
  update: (id: string, patch: Partial<ScopeItem>) => void;
  remove: (id: string) => void;
}) {
  const initialUnitCost = item.qty > 0 ? item.materialsCost / item.qty : item.materialsCost;
  const unitCostRef = useRef(initialUnitCost);

  const [qtyText, setQtyText] = useState(String(item.qty));
  const [unitCostText, setUnitCostText] = useState(String(Math.round(initialUnitCost * 100) / 100));
  const [hrsText, setHrsText] = useState(String(item.labourHrs || 0));

  // Keep local text and the sticky unit-cost ref in sync if the item
  // changes from elsewhere (e.g. a plan-markup re-import, or another
  // row's edit that happens to touch this one) - but not on every
  // render, or the user could never clear a field to retype it.
  useEffect(() => {
    setQtyText(String(item.qty));
    setHrsText(String(item.labourHrs || 0));
    if (item.qty > 0) {
      unitCostRef.current = item.materialsCost / item.qty;
      setUnitCostText(String(Math.round(unitCostRef.current * 100) / 100));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  function commitQty(raw: string) {
    setQtyText(raw);
    if (raw.trim() === "") return; // field is mid-edit (cleared to retype) - don't touch shared state yet
    const qty = Math.max(0, Number(raw) || 0);
    update(item.id, { qty, materialsCost: Math.round(unitCostRef.current * qty * 100) / 100 });
  }

  function commitUnitCost(raw: string) {
    setUnitCostText(raw);
    if (raw.trim() === "") return;
    const newUnitCost = Math.max(0, Number(raw) || 0);
    unitCostRef.current = newUnitCost;
    update(item.id, { materialsCost: Math.round(newUnitCost * item.qty * 100) / 100 });
  }

  function commitHrs(raw: string) {
    setHrsText(raw);
    if (raw.trim() === "") return;
    update(item.id, { labourHrs: Math.max(0, Number(raw) || 0) });
  }

  return (
    <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <input
          value={item.label}
          onChange={(e) => update(item.id, { label: e.target.value })}
          className="w-full bg-transparent text-[13.5px] font-medium text-[var(--ink)] focus:outline-none"
        />
        {(item.source || item.overridden) && (
          <p className="text-[10.5px] text-[var(--ink-faint)] leading-tight">
            {item.source && item.source !== "manual" ? SOURCE_LABELS[item.source] : null}
            {item.source && item.source !== "manual" && item.overridden ? " — " : null}
            {item.overridden ? "edited" : null}
          </p>
        )}
      </div>
      <input
        type="number"
        value={qtyText}
        onChange={(e) => commitQty(e.target.value)}
        onBlur={() => { if (qtyText.trim() === "") commitQty("0"); }}
        className="w-14 bg-[var(--app-bg)] rounded-lg text-center text-[13px] py-1"
        title="Quantity"
      />
      <span className="text-[11px] text-[var(--ink-faint)] w-8">{item.unit}</span>
      <div className="flex items-center gap-1 w-24">
        <span className="text-[12px] text-[var(--ink-faint)]">$</span>
        <input
          type="number"
          value={unitCostText}
          onChange={(e) => commitUnitCost(e.target.value)}
          onBlur={() => { if (unitCostText.trim() === "") commitUnitCost("0"); }}
          className="w-full bg-[var(--app-bg)] rounded-lg text-center text-[13px] py-1"
          title="Unit cost"
        />
      </div>
      <div className="flex items-center gap-1 w-20">
        <input
          type="number"
          step="0.25"
          value={hrsText}
          onChange={(e) => commitHrs(e.target.value)}
          onBlur={() => { if (hrsText.trim() === "") commitHrs("0"); }}
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
}
