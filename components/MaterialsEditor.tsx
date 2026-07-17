"use client";

import { useState } from "react";
import { Trash2, Plus, BookOpen, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import PriceBookSearch, { type PriceBookResult } from "@/components/PriceBookSearch";

export type MaterialRow = { item_key: string; label: string; unit_cost: number };

/**
 * MaterialsEditor
 * ----------------
 * This is a one-time, permanent price-book setup step, not a per-quote
 * material picker - per-quote quantities already live in the intake form
 * itself (e.g. "how many basin taps"), which multiplies against whatever
 * this screen sets as the default unit cost. It's shown here, mid-wizard,
 * only because a real price book hasn't been set up for this trade yet.
 *
 * Two real bugs fixed alongside the copy/framing rework:
 * - Selecting an item from the real price book search never actually
 *   kept its real UUID id - every add, whether from search or typed
 *   manually, was assigned a synthetic "custom_..." key, so there was
 *   no way to ever accumulate real price_book_items rows through this
 *   screen at all, regardless of what a person did on it.
 * - A manually-typed custom item now gets inserted into price_book_items
 *   for real (tagged to this trade), instead of only existing inside
 *   this one quote's local component state and then disappearing.
 */
export default function MaterialsEditor({
  lib,
  setLib,
  trade,
  defaults = [],
}: {
  lib: MaterialRow[];
  setLib: React.Dispatch<React.SetStateAction<MaterialRow[]>>;
  trade?: string;
  /** The trade's built-in generic defaults, so rows still using one of
   *  these unconfirmed placeholder prices can be flagged as such. */
  defaults?: readonly { item_key: string; label: string; unit_cost: number }[];
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newCost,  setNewCost]  = useState("");
  const [fromBookId, setFromBookId] = useState<string | null>(null); // real price_book_items.id, once selected
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const defaultKeys = new Set(defaults.map((d) => d.item_key));

  function updateCost(item_key: string, value: number) {
    setLib((prev) => prev.map((m) => (m.item_key === item_key ? { ...m, unit_cost: value } : m)));
  }

  function remove(item_key: string) {
    setLib((prev) => prev.filter((m) => m.item_key !== item_key));
  }

  function handlePriceBookSelect(item: PriceBookResult) {
    setNewLabel(item.description);
    setNewCost(String(item.cost_price));
    setFromBookId(item.id);
  }

  async function addItem() {
    const label = newLabel.trim();
    if (!label) return;
    const cost = Number(newCost) || 0;
    setSaveError(null);

    // Already a real price-book row (picked via search) - just add it to
    // this trade's working list with its real, permanent id.
    if (fromBookId) {
      setLib((prev) => [...prev, { item_key: fromBookId, label, unit_cost: cost }]);
      setNewLabel(""); setNewCost(""); setFromBookId(null);
      return;
    }

    // A genuinely new, manually-typed item - save it as a real
    // price_book_items row (not just local state) so it's a permanent
    // part of the actual price book, tagged to this trade, and counts
    // toward unlocking the proper picker for every future quote.
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setSaveError("Not signed in"); return; }
      const businessId = await getActiveBusinessId(supabase, userData.user.id);

      const { data: row, error } = await supabase
        .from("price_book_items")
        .insert({ profile_id: businessId, supplier: "Manual entry", description: label, cost_price: cost, trade: trade ?? null })
        .select("id")
        .single();

      if (error || !row) { setSaveError(error?.message ?? "Failed to save"); return; }

      setLib((prev) => [...prev, { item_key: row.id, label, unit_cost: cost }]);
      setNewLabel(""); setNewCost(""); setFromBookId(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <p className="section-tag mb-1">Materials</p>
      <p className="font-semibold text-[var(--ink)] mb-1">
        Set your default {trade ?? ""} prices
      </p>
      <p className="text-[12.5px] text-[var(--ink-faint)] mb-3">
        These are saved permanently and used automatically on every {trade ?? ""} quote from now on - not just this
        one. Search your real supplier price book, or add a price yourself. Rows still marked
        &quot;placeholder&quot; below are generic estimates, not your real costs.
      </p>

      <div className="divide-y divide-[var(--line-subtle)] mb-3">
        {lib.map((m) => (
          <div key={m.item_key} className="flex items-center gap-2.5 py-2.5 group">
            <div className="flex-1 min-w-0">
              <span className="text-[13.5px] text-[var(--ink)] block truncate">{m.label}</span>
              {defaultKeys.has(m.item_key) && (
                <span className="text-[10px] font-bold uppercase text-[var(--amber-deep)] bg-[var(--amber-light)] px-1.5 py-0.5 rounded">
                  Placeholder - not your real price yet
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[13px] text-[var(--ink-faint)]">$</span>
              <input
                type="number"
                value={m.unit_cost}
                onChange={(e) => updateCost(m.item_key, Number(e.target.value))}
                className="app-field text-right py-1.5 w-20 text-[13px]"
              />
            </div>
            <button onClick={() => remove(m.item_key)} className="text-[var(--ink-faint)] hover:text-[var(--red)] shrink-0 p-1" aria-label={`Remove ${m.label}`}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {lib.length === 0 && (
          <p className="text-[13px] text-[var(--ink-faint)] py-2">No prices set yet - add one below.</p>
        )}
      </div>

      {saveError && <p className="text-[12px] text-[var(--red)] mb-2">{saveError}</p>}

      {/* Price book search -- searches supplier imports, falls back to manual */}
      <div className="bg-[var(--app-bg)] rounded-xl p-2 space-y-2">
        <PriceBookSearch
          trade={trade}
          onSelect={handlePriceBookSelect}
          placeholder="Search price book or type a material name..."
          initialValue={newLabel}
        />

        <div className="flex items-center gap-2">
          {fromBookId && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--green)] font-semibold shrink-0">
              <BookOpen size={11} /> From price book
            </span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[13px] text-[var(--ink-faint)]">$</span>
            <input
              type="number"
              value={newCost}
              onChange={(e) => { setNewCost(e.target.value); setFromBookId(null); }}
              placeholder="0"
              className="app-field text-[13px] w-20 bg-[var(--surface)]"
            />
          </div>
          <button
            onClick={addItem}
            disabled={!newLabel.trim() || saving}
            className="btn-primary text-[12.5px] py-2 px-3 shrink-0"
            style={{ width: "auto" }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} {saving ? "Saving..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
