"use client";

import { useState } from "react";
import { Trash2, Plus } from "lucide-react";

export type MaterialRow = { item_key: string; label: string; unit_cost: number };

export default function MaterialsEditor({
  lib,
  setLib,
}: {
  lib: MaterialRow[];
  setLib: React.Dispatch<React.SetStateAction<MaterialRow[]>>;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newCost, setNewCost] = useState("");

  function updateCost(item_key: string, value: number) {
    setLib((prev) => prev.map((m) => (m.item_key === item_key ? { ...m, unit_cost: value } : m)));
  }

  function remove(item_key: string) {
    setLib((prev) => prev.filter((m) => m.item_key !== item_key));
  }

  function addCustom() {
    if (!newLabel.trim()) return;
    // Slugify the label for a stable item_key, with a short random suffix to
    // dodge collisions if the same label gets added twice in one session.
    const slug = newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const item_key = `custom_${slug}_${Math.random().toString(36).slice(2, 6)}`;
    setLib((prev) => [...prev, { item_key, label: newLabel.trim(), unit_cost: Number(newCost) || 0 }]);
    setNewLabel("");
    setNewCost("");
  }

  return (
    <div className="card">
      <p className="section-tag mb-1">Materials</p>
      <p className="font-semibold text-[var(--ink)] mb-1">Prices for this quote</p>
      <p className="text-[12.5px] text-[var(--ink-faint)] mb-3">
        Adjust any price, remove what doesn&apos;t apply, or add something missing — right here, no need to leave the quote.
      </p>

      <div className="divide-y divide-[var(--line-subtle)] mb-3">
        {lib.map((m) => (
          <div key={m.item_key} className="flex items-center gap-2.5 py-2.5 group">
            <span className="text-[13.5px] text-[var(--ink)] flex-1 truncate">{m.label}</span>
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
        {lib.length === 0 && <p className="text-[13px] text-[var(--ink-faint)] py-2">No materials listed - add one below.</p>}
      </div>

      <div className="flex items-center gap-2 bg-[var(--app-bg)] rounded-xl p-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="e.g. Custom skylight flashing"
          className="app-field text-[13px] flex-1 bg-[var(--surface)]"
        />
        <span className="text-[13px] text-[var(--ink-faint)]">$</span>
        <input
          type="number"
          value={newCost}
          onChange={(e) => setNewCost(e.target.value)}
          placeholder="0"
          className="app-field text-[13px] w-20 bg-[var(--surface)]"
        />
        <button onClick={addCustom} disabled={!newLabel.trim()} className="btn-secondary text-[12.5px] py-2 px-3 shrink-0">
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}
