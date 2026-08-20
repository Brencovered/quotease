import { describe, expect, it } from "vitest";
import { quoteInvoiceExGst, sumMarkupMaterialsField } from "./exportQuoteTotal";

describe("sumMarkupMaterialsField", () => {
  it("sums array line items", () => {
    expect(
      sumMarkupMaterialsField([
        { label: "A", totalCost: 100 },
        { label: "B", totalCost: 50.5 },
      ])
    ).toBe(150.5);
  });

  it("accepts legacy numeric totals", () => {
    expect(sumMarkupMaterialsField(220)).toBe(220);
    expect(sumMarkupMaterialsField("80")).toBe(80);
  });

  it("does not coerce arrays via + (the export bug)", () => {
    // Regression: (total_cost ?? 0) + (markup_materials ?? 0) when markup is []
    // becomes the string "1500", then selectedTotal concatenates.
    expect(sumMarkupMaterialsField([])).toBe(0);
    expect(1500 + sumMarkupMaterialsField([{ totalCost: 100 }])).toBe(1600);
  });
});

describe("quoteInvoiceExGst", () => {
  it("adds base + markup lines + approved variations", () => {
    expect(
      quoteInvoiceExGst({
        totalCost: 1000,
        markupMaterials: [{ totalCost: 200 }, { totalCost: 50 }],
        approvedVariationsTotal: 100,
      })
    ).toBe(1350);
  });
});
