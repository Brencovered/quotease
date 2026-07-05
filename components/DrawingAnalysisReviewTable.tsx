"use client";

/**
 * DrawingAnalysisReviewTable
 * --------------------------
 * Review step after AI drawing analysis. Detected items are abstract
 * archetypes ("Downlight" x14, "Cable run" 40m) -- fast to count, but they
 * must NEVER price themselves from templates or fuzzy label guesses:
 * pricing comes from the tradie's real price book.
 *
 * Pricing resolution per row:
 *   1. Remembered default (profiles.archetype_defaults["trade:key"]) -->
 *      auto-priced with the real product, shown under the label.
 *   2. No default --> "Price book" opens a searchable picker scoped to the
 *      archetype's category. Selection prices the row AND is saved as the
 *      default for next time.
 *   3. Manual price entry stays available and is flagged as manual.
 */

import { useState } from "react";
import { Check, AlertTriangle, X, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import CategoryMaterialPicker, { type PickerItem } from "@/components/CategoryMaterialPicker";

export interface DetectedItem {
  label:    string;
  item_key: string;
  quantity: number;
  unit:     string;
  /** AI's starting estimate of total install time for this row, hours. */
  labour_hours?: number;
}

interface ReviewRow extends DetectedItem {
  confirmedQty: number;
  unitPrice:    number | null;
  confirmedLabourHrs: number;
  /** Real price book product backing this row's price, if any */
  product:      PickerItem | null;
  /** Price typed by hand rather than from the price book */
  manual:       boolean;
}

export interface ReviewLineItem {
  label:     string;
  item_key:  string;
  quantity:  number;
  unit:      string;
  unitPrice: number | null;
  total:     number | null;
  labourHrs: number;
}

export default function DrawingAnalysisReviewTable({
  detectedItems,
  confidence,
  notes,
  lib,
  trade = "electrician",
  archetypeDefaults = {},
  onSaveDefault,
  onAccept,
  onDismiss,
}: {
  detectedItems: DetectedItem[];
  confidence:    "high" | "medium" | "low";
  notes:         string;
  lib:           PickerItem[];
  trade?:        string;
  /** Map "trade:archetype_key" -> price_book item_key from profiles.archetype_defaults */
  archetypeDefaults?: Record<string, string>;
  /** Persist a newly chosen default; fire-and-forget. Optional -- when
      absent (older trade builders), selections still price the row but
      aren't remembered across quotes. */
  onSaveDefault?: (archetypeKey: string, itemKey: string) => void;
  onAccept:      (items: ReviewLineItem[]) => void;
  onDismiss:     () => void;
}) {
  const initialRows: ReviewRow[] = detectedItems.map((item) => {
    const defaultItemKey = archetypeDefaults[`${trade}:${item.item_key}`];
    const product = defaultItemKey ? lib.find((m) => m.item_key === defaultItemKey) ?? null : null;
    return {
      ...item,
      confirmedQty: item.quantity,
      unitPrice:    product ? Number(product.unit_cost) : null,
      confirmedLabourHrs: item.labour_hours ?? 0,
      product,
      manual:       false,
    };
  });

  const [rows,       setRows]       = useState<ReviewRow[]>(initialRows);
  const [collapsed,  setCollapsed]  = useState(false);
  const [pickerIdx,  setPickerIdx]  = useState<number | null>(null);

  function updateQty(idx: number, qty: number) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, confirmedQty: Math.max(0, qty) } : r)));
  }

  function updateLabourHrs(idx: number, hrs: number) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, confirmedLabourHrs: Math.max(0, hrs) } : r)));
  }

  function updatePrice(idx: number, price: number) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, unitPrice: price, manual: true, product: null } : r)));
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function pickProduct(idx: number, item: PickerItem) {
    setRows((prev) => prev.map((r, i) =>
      i === idx ? { ...r, unitPrice: Number(item.unit_cost), product: item, manual: false } : r
    ));
    onSaveDefault?.(rows[idx].item_key, item.item_key);
    setPickerIdx(null);
  }

  const grandTotal = rows.reduce((s, r) =>
    r.confirmedQty > 0 && r.unitPrice != null ? s + r.confirmedQty * r.unitPrice : s, 0);

  const totalLabourHrs = rows.reduce((s, r) => (r.confirmedQty > 0 ? s + r.confirmedLabourHrs : s), 0);

  const hasUnpriced = rows.some((r) => r.unitPrice == null && r.confirmedQty > 0);
  const hasManual   = rows.some((r) => r.manual && r.confirmedQty > 0);

  function handleAccept() {
    const lineItems: ReviewLineItem[] = rows
      .filter((r) => r.confirmedQty > 0)
      .map((r) => ({
        // Carry the real product name into the quote line so what the client
        // sees matches what actually gets installed and costed.
        label:     r.product ? `${r.label} — ${r.product.label}` : r.label,
        item_key:  r.product?.item_key ?? r.item_key,
        quantity:  r.confirmedQty,
        unit:      r.unit,
        unitPrice: r.unitPrice,
        total:     r.unitPrice != null ? Math.round(r.confirmedQty * r.unitPrice) : null,
        labourHrs: r.confirmedLabourHrs,
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
          <p className="text-[12px] text-[var(--ink-faint)]">Counts from the drawing, prices from your price book, labour hours estimated -- adjust before adding</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCollapsed((c) => !c)} className="text-[var(--ink-faint)] p-1">
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
          <div className="space-y-1 mb-3">
            <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">
              <div className="col-span-4">Item</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-1 text-center">Unit</div>
              <div className="col-span-2 text-center">Hrs</div>
              <div className="col-span-3 text-center">Unit price</div>
              <div className="col-span-1"></div>
            </div>

            {rows.length === 0 && (
              <p className="text-[12.5px] text-[var(--ink-faint)] text-center py-3">No items detected</p>
            )}

            {rows.map((row, idx) => {
              const lineTotal = row.unitPrice != null ? row.confirmedQty * row.unitPrice : null;
              return (
                <div key={idx} className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 items-center bg-[var(--app-bg)] rounded-xl px-2 py-2">
                  {/* Label + backing product */}
                  <div className="col-span-4 min-w-0">
                    <p className="font-semibold text-[12.5px] text-[var(--ink)] leading-tight">{row.label}</p>
                    {row.product ? (
                      <button
                        onClick={() => setPickerIdx(idx)}
                        className="text-[10.5px] text-[var(--navy)] underline decoration-dotted truncate block max-w-full text-left"
                        title={row.product.label}
                      >
                        {row.product.label}
                      </button>
                    ) : row.manual ? (
                      <p className="text-[10.5px] text-amber-600 font-semibold">Manual price</p>
                    ) : null}
                    {lineTotal != null && (
                      <p className="text-[11px] text-[var(--ink-faint)]">${lineTotal.toLocaleString()}</p>
                    )}
                  </div>

                  {/* Qty */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={0}
                      step={row.unit === "m" || row.unit === "m2" ? 0.5 : 1}
                      value={row.confirmedQty}
                      onChange={(e) => updateQty(idx, Number(e.target.value))}
                      className="app-field text-center text-[13px] font-bold py-1.5 w-full"
                    />
                  </div>

                  {/* Unit */}
                  <div className="col-span-1 text-center">
                    <span className="text-[11px] text-[var(--ink-soft)] font-semibold">{row.unit}</span>
                  </div>

                  {/* Labour hours -- AI estimate, editable, never shown to the customer */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      value={row.confirmedLabourHrs}
                      onChange={(e) => updateLabourHrs(idx, Number(e.target.value))}
                      className="app-field text-center text-[12.5px] py-1.5 w-full"
                      title="Estimated labour hours for this line"
                    />
                  </div>

                  {/* Price: from product, manual, or picker */}
                  <div className="col-span-3">
                    {row.unitPrice != null ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-[var(--ink-faint)]">$</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={row.unitPrice}
                          onChange={(e) => updatePrice(idx, Number(e.target.value))}
                          className="app-field text-center text-[12.5px] py-1.5 flex-1 min-w-0"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setPickerIdx(idx)}
                        className="w-full flex items-center justify-center gap-1 text-[10.5px] font-bold text-[var(--navy)] bg-[var(--navy)]/5 border border-[var(--navy)]/20 rounded-lg py-1.5 hover:bg-[var(--navy)]/10"
                      >
                        <BookOpen size={10} /> Price book
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

          {(grandTotal > 0 || totalLabourHrs > 0) && (
            <div className="flex items-center justify-between px-2 py-2 border-t border-[var(--line-subtle)] mb-3">
              <span className="font-bold text-[13px] text-[var(--ink-soft)]">Materials total{totalLabourHrs > 0 ? ` + ${totalLabourHrs}hrs labour` : ""}</span>
              <span className="font-display text-[18px] text-[var(--ink)]">${Math.round(grandTotal).toLocaleString()}</span>
            </div>
          )}

          {hasUnpriced && (
            <div className="flex items-center gap-1.5 text-[11.5px] text-amber-600 mb-2">
              <AlertTriangle size={12} />
              <span>Some items aren&apos;t priced yet — tap &quot;Price book&quot; to choose the product you install.</span>
            </div>
          )}
          {hasManual && (
            <div className="flex items-center gap-1.5 text-[11.5px] text-amber-600 mb-2">
              <AlertTriangle size={12} />
              <span>Manually priced items aren&apos;t linked to your price book — supplier price changes won&apos;t flow through.</span>
            </div>
          )}

          <button
            onClick={handleAccept}
            disabled={rows.filter((r) => r.confirmedQty > 0).length === 0}
            className="btn-primary w-full justify-center"
          >
            <Check size={14} />
            Add {rows.filter((r) => r.confirmedQty > 0).length} item{rows.filter((r) => r.confirmedQty > 0).length !== 1 ? "s" : ""} to quote
            {grandTotal > 0 && <span className="ml-1 opacity-80">(${Math.round(grandTotal).toLocaleString()})</span>}
          </button>
        </>
      )}

      {pickerIdx !== null && rows[pickerIdx] && (
        <CategoryMaterialPicker
          trade={trade}
          archetypeKey={rows[pickerIdx].item_key}
          archetypeLabel={rows[pickerIdx].label}
          lib={lib}
          onSelect={(item) => pickProduct(pickerIdx, item)}
          onClose={() => setPickerIdx(null)}
        />
      )}
    </div>
  );
}
