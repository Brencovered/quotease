import { describe, expect, it } from "vitest";
import { parseSummary, structureToQuoteLines, structureToWizardLines, structureTrade } from "./structurePlans";

const raw = {
  description: "360 × 600 cm gable roof",
  materialsTotal: 1100,
  labourRate: 100,
  lines: [
    { key: "t:Studs:90x45", group: "Framing timber", label: "Studs, 90x45", quantity: 120, unit: "m", unitCost: 5.82, totalCost: 698.4 },
    { key: "c:concrete", group: "Slab", label: "Concrete, 10 cm thick", quantity: 2.4, unit: "m³", unitCost: 0, totalCost: 0 },
    { key: "waste", group: "Allowances", label: "Waste and fixings allowance (10%)", quantity: 1, unit: "lot", unitCost: 69.84, totalCost: 69.84 },
    { label: "", quantity: 1 },
  ],
  labour: [
    { key: "frame", label: "Wall and roof framing", hours: 18 },
    { key: "finish", label: "Finishing off", hours: 0 },
  ],
};

describe("structure plans", () => {
  it("parses and drops malformed lines", () => {
    const s = parseSummary(raw);
    expect(s.lines).toHaveLength(3);
    expect(s.labour).toHaveLength(2);
    expect(parseSummary(null)).toEqual({});
  });

  it("wizard lines keep raw cost, include unpriced lines and labour hours", () => {
    const lines = structureToWizardLines(parseSummary(raw));
    expect(lines.map((l) => l.label)).toEqual([
      "Studs, 90x45",
      "Concrete, 10 cm thick",
      "Waste and fixings allowance (10%)",
      "Labour: Wall and roof framing",
    ]);
    expect(lines[0].totalCost).toBe(698.4);
    expect(lines[3]).toMatchObject({ labourHrs: 18, totalCost: 0 });
  });

  it("quote lines bake in margin, skip unpriced, price labour", () => {
    const { lines, skipped } = structureToQuoteLines(parseSummary(raw), 20, 85);
    expect(skipped).toBe(1);
    expect(lines[0]).toMatchObject({ unitCost: 6.98, totalCost: 838 });
    expect(lines.at(-1)).toMatchObject({ label: "Labour: Wall and roof framing", unitCost: 100, totalCost: 1800 });
  });

  it("falls back to the business hourly rate", () => {
    const { lines } = structureToQuoteLines(parseSummary({ ...raw, labourRate: 0 }), 0, 85);
    expect(lines.at(-1)?.totalCost).toBe(1530);
  });

  it("prefers carpentry-type trades", () => {
    expect(structureTrade(["electrician", "carpenter"])).toBe("carpenter");
    expect(structureTrade(["plumber"])).toBe("plumber");
    expect(structureTrade(null)).toBe("carpenter");
  });
});
