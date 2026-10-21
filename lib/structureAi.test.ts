import { describe, expect, it } from "vitest";
import { normalizeGeneratedPlan, normalizePhotoRead, normalizePlanRead, normalizeTraceDraft, photoSuggestions, type GeneratedPlan, type PhotoContext } from "./structureAi";

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

describe("normalizeTraceDraft", () => {
  it("clamps coordinates, drops junk walls and short outlines", () => {
    const n = normalizeTraceDraft({
      outline: [[-5, 10], [1200, 10], [1200, 900], [0, 900]],
      walls: [[100, 100, 100, 101], [100, 100, 100, 500]],
      rooms: [{ name: "Bed 1", width: 3500, length: 3000, x: 50, y: 60 }],
      openings: [{ type: "door", x: 10, y: 20 }],
    });
    expect(n.outline[0]).toEqual([0, 10]);
    expect(n.outline[1]).toEqual([1000, 10]);
    expect(n.walls).toEqual([[100, 100, 100, 500]]);
    expect(n.rooms[0]).toMatchObject({ name: "Bed 1", width: 3500 });
    expect(normalizeTraceDraft({ outline: [[1, 1]], walls: [], rooms: [], openings: [] }).outline).toEqual([]);
  });

  it("turns a garage door into a slider unless a room is labelled Garage", () => {
    const openings = [
      { type: "garage" as const, x: 100, y: 200 },
      { type: "window" as const, x: 300, y: 200 },
    ];
    const bare = normalizeTraceDraft({
      outline: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]],
      walls: [],
      rooms: [{ name: "Living", width: 0, length: 0, x: 400, y: 400 }],
      openings,
    });
    expect(bare.openings.map((o) => o.type)).toEqual(["slider", "window"]);
    const withGarage = normalizeTraceDraft({
      outline: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]],
      walls: [],
      rooms: [{ name: "Garage", width: 5500, length: 5500, x: 200, y: 400 }],
      openings,
    });
    expect(withGarage.openings.map((o) => o.type)).toEqual(["garage", "window"]);
  });
});

describe("normalizePhotoRead", () => {
  it("clamps numbers, keeps unknowns at zero and trims text", () => {
    const n = normalizePhotoRead({
      storeys: 7,
      roofShape: "hip",
      roofMaterial: "tiles",
      roofPitch: 22.3,
      cladding: "brick",
      eavesMm: 470,
      wallHeightMm: 2720,
      deck: "alfresco",
      deckInOutline: "yes",
      scaleOk: "check",
      scaleNote: "  The house looks wider than 8 m. ",
      gutter: "  Quad   gutter, Monument ",
      windows: "Aluminium",
      colours: "x".repeat(300),
      notes: ["a", "", "b", "c", "d", "e", "f", "g"],
    });
    expect(n.storeys).toBe(3);
    expect(n.roofPitch).toBe(22.5);
    expect(n.eavesMm).toBe(450);
    expect(n.wallHeightMm).toBe(2700);
    expect(n.scaleNote).toBe("The house looks wider than 8 m.");
    expect(n.gutter).toBe("Quad gutter, Monument");
    expect(n.colours.length).toBe(120);
    expect(n.notes).toEqual(["a", "b", "c", "d", "e", "f"]);
    const u = normalizePhotoRead({
      storeys: 0, roofShape: "unknown", roofMaterial: "unknown", roofPitch: 0, cladding: "unknown", eavesMm: 0,
      wallHeightMm: 1800, deck: "unknown", deckInOutline: "unknown", scaleOk: "ok", scaleNote: "ignore",
      gutter: "", windows: "", colours: "", notes: [],
    });
    expect(u.storeys).toBe(0);
    expect(u.roofPitch).toBe(0);
    expect(u.eavesMm).toBe(0);
    expect(u.wallHeightMm).toBe(0);
    expect(u.scaleNote).toBe("");
  });
});

const JOB: PhotoContext = { storeys: 1, wallH: 2400, extClad: "brick", roofType: "hip", roofMat: "tiles", pitch: 22.5, eave: 450, outdoor: [] };

describe("photoSuggestions", () => {
  const base = () => normalizePhotoRead({
    storeys: 1, roofShape: "hip", roofMaterial: "tiles", roofPitch: 22.5, cladding: "brick", eavesMm: 450,
    wallHeightMm: 2400, deck: "none", deckInOutline: "unknown", scaleOk: "ok", scaleNote: "",
    gutter: "", windows: "", colours: "", notes: [],
  });

  it("stays quiet when the photos match the job", () => {
    expect(photoSuggestions(base(), JOB)).toEqual([]);
  });

  it("bundles roof, walls and ceiling, and does not suggest floors, scale or a deck", () => {
    const read = base();
    read.cladding = "weatherboard";
    read.roofShape = "skillion";
    read.roofMaterial = "colorbond";
    read.roofPitch = 8;
    read.eavesMm = 200;
    read.wallHeightMm = 2700;
    read.storeys = 2;
    read.scaleOk = "check";
    read.scaleNote = "A garage door looks wider than the scale allows.";
    read.deck = "alfresco";
    read.deckInOutline = "yes";
    const s = photoSuggestions(read, JOB);
    expect(s).toHaveLength(1);
    expect(s[0]?.apply).toMatchObject({ extClad: "weatherboard", roofType: "skillion", roofMat: "colorbond", pitch: 8, eave: 200, wallH: 2700 });
    expect(s[0]?.kind).toBe("setting");
    expect(s[0]?.apply).not.toHaveProperty("addFloors");
    expect(s.map((x) => x.id)).toEqual(["build"]);
  });

  it("treats a flat roof with no pitch as 2 degrees", () => {
    const read = base();
    read.roofShape = "flat";
    read.roofPitch = 0;
    read.storeys = 2;
    read.deck = "deck";
    read.deckInOutline = "no";
    const s = photoSuggestions(read, { ...JOB, storeys: 2, outdoor: ["Alfresco"] });
    expect(s).toHaveLength(1);
    expect(s[0]?.apply).toMatchObject({ roofType: "flat", pitch: 2 });
    expect(s[0]?.apply).not.toHaveProperty("addFloors");
  });
});
