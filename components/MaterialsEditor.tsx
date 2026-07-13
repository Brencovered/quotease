"use client";

import { useState } from "react";
import { Trash2, Plus, BookOpen } from "lucide-react";
import PriceBookSearch, { type PriceBookResult } from "@/components/PriceBookSearch";

export type MaterialRow = { item_key: string; label: string; unit_cost: number };

export default function MaterialsEditor({
  lib,
  setLib,
  trade,
}: {
  lib: MaterialRow[];
  setLib: React.Dispatch<React.SetStateAction<MaterialRow[]>>;
  trade?: string;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newCost,  setNewCost]  = useState("");
  const [fromBook, setFromBook] = useState(false); // true when price came from price book

  function updateCost(item_key: string, value: number) {
    setLib((prev) => prev.map((m) => (m.item_key === item_key ? { ...m, unit_cost: value } : m)));
  }

  function remove(item_key: string) {
    setLib((prev) => prev.filter((m) => m.item_key !== item_key));
  }

  function addItem(label: string, cost: number) {
    if (!label.trim()) return;
    const slug     = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const item_key = `custom_${slug}_${Math.random().toString(36).slice(2, 6)}`;
    setLib((prev) => [...prev, { item_key, label: label.trim(), unit_cost: cost }]);
    setNewLabel("");
    setNewCost("");
    setFromBook(false);
  }

  function handlePriceBookSelect(item: PriceBookResult) {
    setNewLabel(item.description);
    setNewCost(String(item.cost_price));
    setFromBook(true);
  }

  return (
    <div className="card">
      <p className="section-tag mb-1">Materials</p>
      <p className="font-semibold text-[var(--ink)] mb-1">Prices for this quote</p>
      <p className="text-[12.5px] text-[var(--ink-faint)] mb-3">
        Search your supplier price book or type manually. Adjust any price or remove what doesn&apos;t apply.
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
        {lib.length === 0 && (
          <p className="text-[13px] text-[var(--ink-faint)] py-2">No materials listed - add one below.</p>
        )}
      </div>

      {/* Price book search -- searches supplier imports, falls back to manual */}
      <div className="bg-[var(--app-bg)] rounded-xl p-2 space-y-2">
        <PriceBookSearch
          trade={trade}
          onSelect={handlePriceBookSelect}
          placeholder="Search price book or type a material name..."
          initialValue={newLabel}
        />

        <div className="flex items-center gap-2">
          {fromBook && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--green)] font-semibold shrink-0">
              <BookOpen size={11} /> From price book
            </span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[13px] text-[var(--ink-faint)]">$</span>
            <input
              type="number"
              value={newCost}
              onChange={(e) => { setNewCost(e.target.value); setFromBook(false); }}
              placeholder="0"
              className="app-field text-[13px] w-20 bg-[var(--surface)]"
            />
          </div>
          <button
            onClick={() => addItem(newLabel, Number(newCost) || 0)}
            disabled={!newLabel.trim()}
            className="btn-primary text-[12.5px] py-2 px-3 shrink-0"
            style={{ width: "auto" }}>
            <Plus size={13} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
