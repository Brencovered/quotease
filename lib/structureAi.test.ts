import { describe, expect, it } from "vitest";
import { normalizeGeneratedPlan, normalizePlanRead, type GeneratedPlan } from "./structureAi";

const base: GeneratedPlan = {
  name: "Test",
  shed: {
    type: "enclosed", width: 6000, length: 9000, height: 3000, roof: "gable", roofDir: "90", pitch: 12, overhang: 300,
    studSize: "90x45", studSpacing: "600", rafterSize: "190x45", rafterSpacing: "900", floor: "slab",
    slabT: 125, mesh: "SL82", floorSheet: null, floorH: null, paverType: null, gravelType: null,
    wallMat: "corr", roofMat: "corr", wallColor: "Surfmist", roofColor: "Monument", doorColor: "Monument",
  },
  openings: [{ type: "roller", wall: "front", offset: 0, width: 3000, height: 2700, sill: 0, build: "kit" }],
  internalWalls: [],
  items: [],
  warnings: [],
};

describe("normalizeGeneratedPlan", () => {
  it("passes a sensible plan through", () => {
    const n = normalizeGeneratedPlan(base);
    expect(n.shed).toMatchObject({ width: 6000, length: 9000, roofDir: 90, studSpacing: 600, slabT: 125, mesh: "SL82" });
    expect(n.openings[0]).toMatchObject({ width: 3000, height: 2700, sill: 0 });
  });

  it("clamps absurd sizes and keeps openings inside their wall", () => {
    const n = normalizeGeneratedPlan({
      ...base,
      shed: { ...base.shed, width: 99999, height: 100, roof: "gable", roofDir: "270" },
      openings: [
        { type: "roller", wall: "front", offset: 99999, width: 99999, height: 9999, sill: 50, build: "alum" },
        { type: "window", wall: "left", offset: 0, width: 1200, height: 600, sill: 1200, build: "louvre" },
      ],
    });
    expect(n.shed.width).toBe(15000);
    expect(n.shed.height).toBe(1800);
    expect(n.shed.roofDir).toBe(90);
    const roller = n.openings[0];
    expect(roller.build).toBe("kit");
    expect(roller.sill).toBe(0);
    expect(roller.width).toBeLessThanOrEqual(15000 - 400);
    expect(Math.abs(roller.offset) + roller.width / 2).toBeLessThanOrEqual(15000 / 2 - 200);
    expect(roller.height).toBeLessThanOrEqual(1800 - 250);
    const win = n.openings[1];
    expect(win.sill + win.height).toBeLessThanOrEqual(1800 - 250);
  });

  it("fills timber floor defaults and drops unrelated floor fields", () => {
    const n = normalizeGeneratedPlan({ ...base, shed: { ...base.shed, floor: "timber", floorSheet: "ply" } });
    expect(n.shed).toMatchObject({ floor: "timber", floorSheet: "ply", joistSpacing: 600, floorH: 350 });
    expect(n.shed.slabT).toBeUndefined();
  });

  it("snaps item rotation and keeps items on the floor", () => {
    const n = normalizeGeneratedPlan({ ...base, items: [{ name: "Car", w: 4600, d: 1850, h: 1500, x: 99999, z: 0, rot: 100 }] });
    expect(n.items[0]).toMatchObject({ x: 3000, rot: 90, y: 0 });
  });
});

describe("normalizePlanRead", () => {
  it("keeps rooms, flags non-rectangular footprints, clamps rooms", () => {
    const n = normalizePlanRead({
      ...base,
      footprint: "l_shape",
      confidence: "medium",
      rooms: [{ name: "Bed 1", width: 3600, length: 3000 }, { name: "", width: -5, length: 999999 }],
    });
    expect(n.rooms[0]).toEqual({ name: "Bed 1", width: 3600, length: 3000 });
    expect(n.rooms[1]).toEqual({ name: "Room", width: 0, length: 50000 });
    expect(n.warnings[0]).toMatch(/L-shaped/);
    expect(n.confidence).toBe("medium");
  });
});

describe("structure types", () => {
  it("drops openings and walls for open structures and forces deck floors", () => {
    const n = normalizeGeneratedPlan({
      ...base,
      shed: { ...base.shed, type: "deck", floor: "slab", floorH: 900, roofMat: "none" },
      internalWalls: [{ axis: "across", pos: 0, door: true, doorOffset: 0 }],
    });
    expect(n.openings).toHaveLength(0);
    expect(n.internalWalls).toHaveLength(0);
    expect(n.shed).toMatchObject({ type: "deck", floor: "timber", floorSheet: "deck", floorH: 900, roofMat: "corr" });
  });

  it("clamps internal walls inside the building", () => {
    const n = normalizeGeneratedPlan({ ...base, internalWalls: [{ axis: "along", pos: 99999, door: true, doorOffset: -99999 }] });
    expect(n.internalWalls[0]).toEqual({ axis: "along", pos: 2700, door: true, doorOffset: -3900 });
  });

  it("keeps open rafters only on pergolas and forces verandahs to skillion", () => {
    const n = normalizeGeneratedPlan({ ...base, shed: { ...base.shed, type: "verandah", roof: "gable", roofMat: "none" } });
    expect(n.shed).toMatchObject({ roof: "skillion", roofMat: "corr" });
  });
});
