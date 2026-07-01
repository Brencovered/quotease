"use client";

import { useState } from "react";
import { Check, Search, AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";

export interface DetectedItem {
  label:    string;
  item_key: string;
  quantity: number;
  unit:     string;
}

interface ReviewRow extends DetectedItem {
  confirmedQty: number;
  unitPrice:    number | null;
  matched:      boolean;
}

export interface ReviewLineItem {
  label:     string;
  item_key:  string;
  quantity:  number;
  unit:      string;
  unitPrice: number | null;
  total:     number | null;
}

export default function DrawingAnalysisReviewTable({
  detectedItems,
  confidence,
  notes,
  lib,
  onAccept,
  onDismiss,
}: {
  detectedItems: DetectedItem[];
  confidence:    "high" | "medium" | "low";
  notes:         string;
  lib:           { item_key: string; label: string; unit_cost: number }[];
  onAccept:      (items: ReviewLineItem[]) => void;
  onDismiss:     () => void;
}) {
  // Build initial rows -- auto-match to price book
  const initialRows: ReviewRow[] = detectedItems.map(item => {
    // Direct key match first, then alias matching
    const ALIASES: Record<string, string> = {
      dl: "dl_standard", gpo: "pp", sw: "switch_single",
      exhaust: "exhaust_ceiling", cable: "cable_2_5",
      conduit: "cable_2_5", sb: "sb_rcd",
    };
    const lookupKey = ALIASES[item.item_key] ?? item.item_key;
    const match = lib.find(m => m.item_key === lookupKey || m.item_key === item.item_key);
    return {
      ...item,
      confirmedQty: item.quantity,
      unitPrice:    match?.unit_cost ?? null,
      matched:      !!match,
    };
  });

  const [rows,      setRows]      = useState<ReviewRow[]>(initialRows);
  const [collapsed, setCollapsed] = useState(false);

  function updateQty(idx: number, qty: number) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, confirmedQty: Math.max(0, qty) } : r));
  }

  function updatePrice(idx: number, price: number) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, unitPrice: price, matched: true } : r));
  }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx));
  }

  function lookupPrice(idx: number) {
    const row = rows[idx];
    const ALIASES: Record<string, string> = {
      dl: "dl_standard", gpo: "pp", sw: "switch_single",
      exhaust: "exhaust_ceiling", cable: "cable_2_5",
      conduit: "cable_2_5", sb: "sb_rcd",
    };
    const lookupKey = ALIASES[row.item_key] ?? row.item_key;
    // Try fuzzy match on label if no key match
    const match = lib.find(m =>
      m.item_key === lookupKey ||
      m.item_key === row.item_key ||
      m.label.toLowerCase().includes(row.label.toLowerCase().split(" ")[0])
    );
    if (match) {
      setRows(prev => prev.map((r, i) =>
        i === idx ? { ...r, unitPrice: match.unit_cost, matched: true } : r
      ));
    }
  }

  const grandTotal = rows.reduce((s, r) => {
    if (r.confirmedQty > 0 && r.unitPrice != null) {
      return s + r.confirmedQty * r.unitPrice;
    }
    return s;
  }, 0);

  const hasUnmatched = rows.some(r => r.unitPrice == null && r.confirmedQty > 0);

  function handleAccept() {
    const lineItems: ReviewLineItem[] = rows
      .filter(r => r.confirmedQty > 0)
      .map(r => ({
        label:     r.label,
        item_key:  r.item_key,
        quantity:  r.confirmedQty,
        unit:      r.unit,
        unitPrice: r.unitPrice,
        total:     r.unitPrice != null ? Math.round(r.confirmedQty * r.unitPrice) : null,
      }));
    onAccept(lineItems);
  }

  const confStyle = {
    high:   "bg-green-50 border-green-200 text-green-700",
    medium: "bg-amber-50 border-amber-200 text-amber-700",
    low:    "bg-red-50 border-red-100 text-red-700",
  }[confidence];

  return (
    <div className="card border-2 border-[var(--amber-light)] mt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-bold text-[14px] text-[var(--ink)]">Drawing analysis results</p>
          <p className="text-[12px] text-[var(--ink-faint)]">Review quantities and pricing before adding to quote</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCollapsed(c => !c)} className="text-[var(--ink-faint)] p-1">
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button onClick={onDismiss} className="text-[var(--ink-faint)] hover:text-[var(--red)] p-1">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Confidence badge */}
      <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 mb-3 ${confStyle}`}>
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-[12px] font-bold capitalize">{confidence} confidence — review before accepting</p>
          {notes && <p className="text-[11.5px] mt-0.5 opacity-90">{notes}</p>}
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Table */}
          <div className="space-y-1 mb-3">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">
              <div className="col-span-4">Item</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-center">Unit</div>
              <div className="col-span-3 text-center">Unit price</div>
              <div className="col-span-1"></div>
            </div>

            {rows.length === 0 && (
              <p className="text-[12.5px] text-[var(--ink-faint)] text-center py-3">No items detected</p>
            )}

            {rows.map((row, idx) => {
              const lineTotal = row.unitPrice != null ? row.confirmedQty * row.unitPrice : null;
              return (
                <div key={idx} className="grid grid-cols-12 gap-1 items-center bg-[var(--app-bg)] rounded-xl px-2 py-2">
                  {/* Label */}
                  <div className="col-span-4">
                    <p className="font-semibold text-[12.5px] text-[var(--ink)] leading-tight">{row.label}</p>
                    {lineTotal != null && (
                      <p className="text-[11px] text-[var(--ink-faint)]">${lineTotal.toLocaleString()}</p>
                    )}
                  </div>

                  {/* Qty -- editable */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={0}
                      step={row.unit === "m" || row.unit === "m2" ? 0.5 : 1}
                      value={row.confirmedQty}
                      onChange={e => updateQty(idx, Number(e.target.value))}
                      className="app-field text-center text-[13px] font-bold py-1.5 w-full"
                    />
                  </div>

                  {/* Unit */}
                  <div className="col-span-2 text-center">
                    <span className="text-[11px] text-[var(--ink-soft)] font-semibold">{row.unit}</span>
                  </div>

                  {/* Unit price -- editable or lookup */}
                  <div className="col-span-3">
                    {row.unitPrice != null ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-[var(--ink-faint)]">$</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={row.unitPrice}
                          onChange={e => updatePrice(idx, Number(e.target.value))}
                          className="app-field text-center text-[12.5px] py-1.5 flex-1"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => lookupPrice(idx)}
                        className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-[var(--navy)] bg-[var(--navy)]/5 border border-[var(--navy)]/20 rounded-lg py-1.5 hover:bg-[var(--navy)]/10"
                      >
                        <Search size={10} /> Look up
                      </button>
                    )}
                  </div>

                  {/* Remove */}
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeRow(idx)} className="text-[var(--ink-faint)] hover:text-[var(--red)] p-0.5">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grand total */}
          {grandTotal > 0 && (
            <div className="flex items-center justify-between px-2 py-2 border-t border-[var(--line-subtle)] mb-3">
              <span className="font-bold text-[13px] text-[var(--ink-soft)]">Estimated total</span>
              <span className="font-display text-[18px] text-[var(--ink)]">${Math.round(grandTotal).toLocaleString()}</span>
            </div>
          )}

          {hasUnmatched && (
            <div className="flex items-center gap-1.5 text-[11.5px] text-amber-600 mb-3">
              <AlertTriangle size={12} />
              <span>Some items have no price. Tap "Look up" or enter manually.</span>
            </div>
          )}

          {/* Accept button */}
          <button
            onClick={handleAccept}
            disabled={rows.filter(r => r.confirmedQty > 0).length === 0}
            className="btn-primary w-full justify-center"
          >
            <Check size={14} />
            Add {rows.filter(r => r.confirmedQty > 0).length} item{rows.filter(r => r.confirmedQty > 0).length !== 1 ? "s" : ""} to quote
            {grandTotal > 0 && <span className="ml-1 opacity-80">(${Math.round(grandTotal).toLocaleString()})</span>}
          </button>
        </>
      )}
    </div>
  );
}
