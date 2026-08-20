import { describe, expect, it } from "vitest";
import { buildXeroQuoteLineItems } from "./xero";
import { normalizeTradeValue } from "./genericTrades";

describe("normalizeTradeValue (price-book tagging)", () => {
  it("maps known trades and rejects empty / unknown", () => {
    expect(normalizeTradeValue("Roofer")).toBe("roofer");
    expect(normalizeTradeValue("electrician")).toBe("electrician");
    expect(normalizeTradeValue("")).toBeNull();
    expect(normalizeTradeValue("not-a-trade")).toBeNull();
  });
});

describe("buildXeroQuoteLineItems", () => {
  it("falls back to a single lump-sum line when intake has no site items", () => {
    const lines = buildXeroQuoteLineItems({
      id: "abcd1234-xxxx",
      total_cost: 1500,
      invoice_number: "Q-12",
      intake_data: null,
    });
    expect(lines).toEqual([
      {
        Description: "Quote Q-12",
        Quantity: 1,
        UnitAmount: 1500,
        AccountCode: "200",
      },
    ]);
  });

  it("emits scoped materials lines and a remainder for labour", () => {
    const lines = buildXeroQuoteLineItems({
      id: "abcd1234-xxxx",
      total_cost: 500,
      invoice_number: "Q-99",
      intake_data: {
        site_items: [
          { label: "Downlight", qty: 2, unit: "ea", note: "kitchen", materialsCost: 100, labourHrs: 0.4 },
          { label: "GPO", qty: 1, unit: "ea", materialsCost: 50, labourHrs: 0.3 },
        ],
      },
    });

    expect(lines[0]).toMatchObject({
      Description: "Downlight (kitchen)",
      Quantity: 2,
      UnitAmount: 50,
    });
    expect(lines[1]).toMatchObject({
      Description: "GPO",
      Quantity: 1,
      UnitAmount: 50,
    });
    expect(lines[2]).toMatchObject({
      Description: "Labour and other charges",
      Quantity: 1,
      UnitAmount: 350,
    });
  });
});
