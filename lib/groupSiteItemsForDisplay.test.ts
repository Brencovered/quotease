import { describe, expect, it } from "vitest";
import { groupSiteItemsForDisplay } from "./groupSiteItemsForDisplay";

describe("groupSiteItemsForDisplay", () => {
  it("collapses identical label/unit/note rows into summed qty", () => {
    const grouped = groupSiteItemsForDisplay([
      { label: "Downlight, client supply (wire & fit)", qty: 1, unit: "ea", note: "from site markup", materialsCost: 12, labourHrs: 0.2 },
      { label: "Downlight, client supply (wire & fit)", qty: 1, unit: "ea", note: "from site markup", materialsCost: 12, labourHrs: 0.2 },
      { label: "Downlight, client supply (wire & fit)", qty: 1, unit: "ea", note: "from site markup", materialsCost: 12, labourHrs: 0.2 },
      { label: "Cable run", qty: 53.92, unit: "m", note: "", materialsCost: 100, labourHrs: 1 },
      { label: "GPO", qty: 1, unit: "ea", note: "kitchen", materialsCost: 40, labourHrs: 0.5 },
      { label: "GPO", qty: 1, unit: "ea", note: "kitchen", materialsCost: 40, labourHrs: 0.5 },
      { label: "GPO", qty: 1, unit: "ea", note: "ensuite", materialsCost: 40, labourHrs: 0.5 },
    ]);

    expect(grouped).toHaveLength(4);
    expect(grouped[0].label).toBe("Downlight, client supply (wire & fit)");
    expect(grouped[0].qty).toBe(3);
    expect(grouped[0].materialsCost).toBe(36);
    expect(grouped[0].labourHrs).toBeCloseTo(0.6);
    expect(grouped[1]).toMatchObject({ label: "Cable run", qty: 53.92 });
    expect(grouped[2]).toMatchObject({ label: "GPO", note: "kitchen", qty: 2, materialsCost: 80 });
    expect(grouped[3]).toMatchObject({ label: "GPO", note: "ensuite", qty: 1 });
  });

  it("keeps different notes as separate lines", () => {
    const grouped = groupSiteItemsForDisplay([
      { label: "Downlight", qty: 1, unit: "ea", note: "hallway" },
      { label: "Downlight", qty: 1, unit: "ea", note: "ensuite, fan-rated" },
    ]);
    expect(grouped).toHaveLength(2);
  });
});
