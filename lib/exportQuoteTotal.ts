/**
 * Quote totals for Xero / MYOB CSV export.
 *
 * quotes.markup_materials is usually an array of { totalCost } line items
 * (sometimes a legacy number). Adding the array to total_cost with `+`
 * string-coerces it ("1500[object Object]..."), which:
 *   - makes the selected-total UI look insane via reduce concatenation
 *   - throws when CSV builders call `.toFixed(2)` so the download never starts
 */

export function sumMarkupMaterialsField(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  if (Array.isArray(raw)) {
    return raw.reduce((sum: number, item) => {
      if (item && typeof item === "object" && "totalCost" in item) {
        const n = Number((item as { totalCost: unknown }).totalCost);
        return sum + (Number.isFinite(n) ? n : 0);
      }
      return sum;
    }, 0);
  }
  return 0;
}

/** Invoice amount stored/calculated ex-GST in Swiftscope. */
export function quoteInvoiceExGst(input: {
  totalCost: number | null | undefined;
  markupMaterials: unknown;
  approvedVariationsTotal?: number;
}): number {
  const base = Number(input.totalCost) || 0;
  const markup = sumMarkupMaterialsField(input.markupMaterials);
  const variations = Number(input.approvedVariationsTotal) || 0;
  return Math.round(base + markup + variations);
}
