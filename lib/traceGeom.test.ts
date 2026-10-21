import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const TraceGeom = require("../public/planner/trace-geom.js");

describe("house tracer geometry", () => {
  it("sizes a pen-plan door gap from the drawing, not the stroke", () => {
    const pen = TraceGeom.gapLimits(1500, 3);
    const thick = TraceGeom.gapLimits(1500, 18);
    expect(pen.door).toBeGreaterThanOrEqual(100);
    expect(pen.door).toBeLessThanOrEqual(1500 * 0.14);
    expect(pen.win).toBeLessThanOrEqual(1500 * 0.2);
    expect(pen.mmPx).toBeLessThanOrEqual(24);
    expect(thick.mmPx).toBeGreaterThan(8);
    expect(thick.mmPx).toBeLessThan(20);
    expect(thick.door).toBeGreaterThan(60);
    expect(thick.door).toBeLessThanOrEqual(1500 * 0.14);
    const upscaledPen = TraceGeom.gapLimits(1500, 8);
    expect(upscaledPen.mmPx).toBeLessThanOrEqual(12);
    expect(TraceGeom.scaleMmPerPx(280, 3)).toBeLessThanOrEqual(24);
    expect(TraceGeom.scaleMmPerPx(1500, 18)).toBeGreaterThan(8);
    expect(TraceGeom.scaleMmPerPx(1500, 18)).toBeLessThan(20);
  });

  it("puts the left drawing, or the lower one, on the ground", () => {
    const side = TraceGeom.orderDrawings(
      [{ id: "right", box: { x: 800, y: 10, w: 400, h: 300 } }, { id: "left", box: { x: 20, y: 10, w: 400, h: 300 } }],
      false,
    );
    expect(side.hint).toBe("left");
    expect(side.items.map((d: { id: string }) => d.id)).toEqual(["left", "right"]);

    const stack = TraceGeom.orderDrawings(
      [{ id: "upper", box: { x: 40, y: 20, w: 400, h: 300 } }, { id: "lower", box: { x: 40, y: 500, w: 400, h: 300 } }],
      false,
    );
    expect(stack.hint).toBe("lower");
    expect(stack.items[0].id).toBe("lower");

    const pages = TraceGeom.orderDrawings(
      [{ id: "p2", box: { x: 0, y: 900, w: 400, h: 600 } }, { id: "p1", box: { x: 0, y: 0, w: 400, h: 600 } }],
      true,
    );
    expect(pages.hint).toBe("page");
    expect(pages.items.map((d: { id: string }) => d.id)).toEqual(["p1", "p2"]);
  });

  it("prices roof only on the part the floor above does not cover", () => {
    const lower = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const upper = [[0, 0], [100, 0], [100, 100], [0, 100]];
    expect(TraceGeom.roofUncovered(lower, upper, 0, 0)).toBeLessThan(0.05);
    expect(TraceGeom.roofUncovered(lower, upper, 100, 0)).toBeGreaterThan(0.95);
    const half = TraceGeom.roofUncovered(lower, [[0, 0], [50, 0], [50, 100], [0, 100]], 0, 0);
    expect(half).toBeGreaterThan(0.4);
    expect(half).toBeLessThan(0.6);
    expect(TraceGeom.roofUncovered(lower, [], 0, 0)).toBe(1);
  });

  it("scales markup with a replaced plan and counts house services once", () => {
    const drawing = {
      outline: [[0, 0], [10, 0], [10, 8]],
      walls: [{ a: [2, 0], b: [2, 8] }],
      openings: [{ pt: [4, 0] }],
      rooms: [{ pt: [3, 3] }],
      items: [{ pt: [5, 5] }],
      runs: [{ pts: [[0, 0, 100], [6, 0, 100]] }],
      areas: [{ a: [0, 0], b: [4, 2] }],
      shift: [10, -4],
    };
    TraceGeom.scaleDrawing(drawing, 2, 2);
    expect(drawing.outline[1]).toEqual([20, 0]);
    expect(drawing.walls[0].b).toEqual([4, 16]);
    expect(drawing.openings[0].pt).toEqual([8, 0]);
    expect(drawing.runs[0].pts[1]).toEqual([12, 0, 100]);
    expect(drawing.shift).toEqual([20, -8]);

    expect(TraceGeom.mergeQty("h:elec:board", 1, 1)).toBe(1);
    expect(TraceGeom.mergeQty("h:plumb:hws", 1, 2)).toBe(2);
    expect(TraceGeom.mergeQty("h:build:studx", 10, 4)).toBe(14);
  });

  it("drops an even hatch and keeps a lot that runs past the house", () => {
    const hatch = [];
    for (let i = 0; i < 8; i++) hatch.push({ axis: "h", c: 100 + i * 16, a: 40, b: 220 });
    hatch.push({ axis: "h", c: 40, a: 10, b: 400 });
    hatch.push({ axis: "v", c: 30, a: 20, b: 360 });
    const kept = TraceGeom.dropEvenGrid(hatch, 800);
    expect(kept.some((s: { c: number }) => s.c === 40)).toBe(true);
    expect(kept.filter((s: { c: number }) => s.c >= 100).length).toBe(0);

    const house = [[0, 0], [100, 0], [100, 80], [0, 80]];
    expect(TraceGeom.siteLooksLikeLot([[-2, -2], [102, -2], [102, 82], [-2, 82]], house)).toBe(false);
    expect(TraceGeom.siteLooksLikeLot([[-40, -30], [160, -30], [160, 140], [-40, 140]], house)).toBe(true);
  });

  it("drops a bed and a door leaf that never close a room", () => {
    const outline = [[0, 0], [400, 0], [400, 300], [0, 300]];
    const wall = { a: [200, 0], b: [200, 300] };
    const leaf = { a: [200, 80], b: [260, 80] };
    const bed = [
      { a: [40, 40], b: [120, 40] },
      { a: [120, 40], b: [120, 110] },
      { a: [120, 110], b: [40, 110] },
      { a: [40, 110], b: [40, 40] },
    ];
    const kept = TraceGeom.dropFloating([wall, leaf, ...bed], outline, 18);
    expect(kept).toEqual([wall]);
  });
});
