/**
 * lib/groupSiteItemsForDisplay.ts
 * --------------------------------
 * Merges duplicate line items for the customer-facing quote (web page and
 * PDF), so "Downlight, client supply (wire & fit): 1 ea" tapped eighteen
 * times shows as one line at 18 ea instead of eighteen identical rows.
 *
 * Why this lives here and not at the point items are added in the builder:
 * every add path across all five trade builders and all entry channels
 * (manual, voice, drawing, plan markup, packages, material search, site
 * annotations) does a plain array append -- `setSiteItems(prev => [...prev,
 * newItem])`. That is deliberate, not an oversight: each row in the builder
 * is an independently editable entity with its own id, its own note field,
 * and its own delete button. If two downlights on the same job need
 * different notes ("downlight, hallway" vs "downlight, ensuite, needs a
 * fan-rated can"), or if a tradie wants to remove one instance without
 * touching the other, they need to stay separate rows while the quote is
 * being built. Merging at write time would silently collapse that.
 *
 * So the merge happens only where it belongs: rendering the finished quote
 * to the person paying for it, who does not care that eighteen downlights
 * were added one at a time and should never see eighteen identical bullet
 * points. The builder's internal editing view is untouched.
 *
 * Grouping key is (label, unit, note). Same label with a different note is
 * kept separate on purpose -- that note is exactly the kind of distinguishing
 * detail ("ensuite, needs a fan-rated can") that would be lost by grouping
 * on label alone, and losing it after specifically preserving it at add time
 * would be the wrong trade-off.
 */

export interface GroupableItem {
  label: string;
  qty: number;
  unit: string;
  note?: string;
  materialsCost?: number;
  labourHrs?: number;
}

export interface GroupedDisplayItem {
  label: string;
  qty: number;
  unit: string;
  note: string;
  /** Summed across every merged instance. Present only if the source items carried a cost. */
  materialsCost?: number;
  labourHrs?: number;
}

export function groupSiteItemsForDisplay<T extends GroupableItem>(items: T[]): GroupedDisplayItem[] {
  const groups = new Map<string, GroupedDisplayItem>();
  const order: string[] = [];

  for (const item of items) {
    const note = item.note?.trim() ?? "";
    const key = `${item.label}\u0000${item.unit}\u0000${note}`;

    const existing = groups.get(key);
    if (existing) {
      existing.qty += item.qty;
      if (item.materialsCost !== undefined) {
        existing.materialsCost = (existing.materialsCost ?? 0) + item.materialsCost;
      }
      if (item.labourHrs !== undefined) {
        existing.labourHrs = (existing.labourHrs ?? 0) + item.labourHrs;
      }
      continue;
    }

    groups.set(key, {
      label: item.label,
      qty: item.qty,
      unit: item.unit,
      note,
      materialsCost: item.materialsCost,
      labourHrs: item.labourHrs,
    });
    order.push(key);
  }

  // Preserve first-seen order rather than Map insertion order re-sorted --
  // functionally the same here, but explicit so a future refactor that
  // reorders items elsewhere doesn't silently change display order too.
  return order.map((k) => groups.get(k)!);
}
