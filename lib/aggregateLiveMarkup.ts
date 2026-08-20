/**
 * Collapse live camera pins into one quote line per catalog item.
 * Six Downlight taps → one "Downlight" × 6, not six × 1 rows.
 */

export type LiveMarkupPin = {
  label: string;
  itemKey: string;
  qty: number;
  unit: string;
  length?: number;
  note?: string;
};

export type AggregatedMarkupLine = {
  label: string;
  itemKey: string;
  quantity: number;
  unit: string;
  /** How many separate pins/runs were rolled into this line. */
  pinCount: number;
};

/** Strip camera length suffixes like "Cable (~3.2m)" for a stable label. */
function baseLabel(label: string): string {
  return label.replace(/\s*\(~[\d.]+m\)\s*$/i, "").trim() || label;
}

/**
 * Group by itemKey + unit. Sums qty (points usually 1 each; runs use metres).
 * Freeform notes (`__note__`) are excluded - they are not priced lines.
 */
export function aggregateLiveMarkupPins(pins: LiveMarkupPin[]): AggregatedMarkupLine[] {
  const map = new Map<string, AggregatedMarkupLine>();

  for (const pin of pins) {
    if (!pin.itemKey || pin.itemKey === "__note__") continue;
    const key = `${pin.itemKey}::${pin.unit || "each"}`;
    const addQty = Number(pin.qty);
    const qty = Number.isFinite(addQty) && addQty > 0 ? addQty : 1;
    const existing = map.get(key);
    if (existing) {
      existing.quantity = Math.round((existing.quantity + qty) * 100) / 100;
      existing.pinCount += 1;
    } else {
      map.set(key, {
        label: baseLabel(pin.label),
        itemKey: pin.itemKey,
        quantity: Math.round(qty * 100) / 100,
        unit: pin.unit || "each",
        pinCount: 1,
      });
    }
  }

  return Array.from(map.values());
}
