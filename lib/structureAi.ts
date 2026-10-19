/**
 * Describe-to-build for the build planner.
 *
 * The model fills a constrained schema (enums for everything the 3D engine
 * understands, millimetres for sizes). normalizeGeneratedPlan then clamps
 * every number to the ranges the planner's own inputs allow, so a wild
 * answer can never produce geometry the engine cannot draw.
 */
import { z } from "zod";

export const COLORBOND = [
  "Surfmist", "Classic Cream", "Paperbark", "Dune", "Shale Grey", "Bluegum",
  "Basalt", "Woodland Grey", "Monument", "Manor Red", "Cottage Green", "Zincalume",
] as const;

const OPENING_BUILDS = {
  roller: ["kit"],
  pa: ["prehung", "ledge", "colorbond"],
  window: ["alum", "poly", "louvre"],
  opening: ["none"],
} as const;

const ShedSchema = z.object({
  type: z
    .enum(["enclosed", "carport", "pergola", "verandah", "deck"])
    .describe("enclosed = walls all round. carport = posts, beams and a roof, open sides. pergola = posts, beams and rafters, usually no roof sheets. verandah = attached along one side of a house, skillion, house on the high side. deck = raised timber floor, no roof."),
  width: z.number().describe("External frame width in mm (the front wall length)"),
  length: z.number().describe("External frame length in mm (side wall length, front to back)"),
  height: z.number().describe("Wall height in mm, floor to top plate"),
  roof: z.enum(["gable", "skillion", "flat"]),
  roofDir: z
    .enum(["0", "90", "180", "270"])
    .describe("Gable: 0 = ridge runs front to back (along the length), 90 = ridge runs side to side. Skillion: high side 0 = left, 180 = right, 270 = back, 90 = front."),
  pitch: z.number().describe("Roof pitch in degrees"),
  overhang: z.number().describe("Eave overhang in mm"),
  studSize: z.enum(["70x35", "90x35", "90x45"]),
  studSpacing: z.enum(["450", "600"]),
  rafterSize: z.enum(["90x45", "140x45", "190x45"]).describe("Bigger spans need bigger rafters: up to ~3.6 m span 90x45, up to ~6 m 140x45, wider 190x45"),
  rafterSpacing: z.enum(["600", "900", "1200"]),
  floor: z.enum(["slab", "timber", "pavers", "gravel", "none"]),
  slabT: z.number().nullable().describe("Slab thickness in mm, slab only"),
  mesh: z.enum(["SL62", "SL72", "SL82", "none"]).nullable(),
  floorSheet: z.enum(["yt", "ply", "deck"]).nullable().describe("Timber floor only: yellow tongue, structural ply, or hardwood decking"),
  floorH: z.number().nullable().describe("Timber floor only: height above ground in mm"),
  paverType: z.enum(["concrete", "clay", "bluestone", "sandstone", "porcelain"]).nullable(),
  gravelType: z.enum(["crushed", "roadbase", "toppings", "pebbles"]).nullable(),
  wallMat: z.enum(["corr", "trimdek", "weatherboard", "fc", "ply"]).describe("corr = Colorbond corrugated, trimdek = Colorbond Trimdek, weatherboard = painted pine weatherboard, fc = fibre cement sheet, ply = plywood cladding"),
  roofMat: z.enum(["corr", "trimdek", "zinc", "poly", "none"]).describe("zinc = Zincalume corrugated, poly = clear polycarbonate, none = open rafters (pergola only)"),
  wallColor: z.enum(COLORBOND),
  roofColor: z.enum(COLORBOND),
  doorColor: z.enum(COLORBOND),
});

const OpeningSchema = z.object({
  type: z.enum(["roller", "pa", "window", "opening"]).describe("roller = roller door, pa = personal access door, window, opening = open bay with no door"),
  wall: z.enum(["front", "back", "left", "right"]),
  offset: z.number().describe("Centre of the opening measured from the middle of the wall in mm. Positive = to the right when standing outside facing that wall."),
  width: z.number().describe("mm"),
  height: z.number().describe("mm"),
  sill: z.number().describe("Window sill height above floor in mm. 0 for doors."),
  build: z.enum(["kit", "prehung", "ledge", "colorbond", "alum", "poly", "louvre", "none"]).describe("roller: kit. pa: prehung, ledge or colorbond. window: alum, poly or louvre. opening: none."),
});

const ItemSchema = z.object({
  name: z.string(),
  w: z.number().describe("Length in mm"),
  d: z.number().describe("Depth in mm"),
  h: z.number().describe("Height in mm"),
  x: z.number().describe("Centre position left/right from the middle of the floor in mm"),
  z: z.number().describe("Centre position front/back from the middle of the floor in mm, positive towards the front"),
  rot: z.number().describe("Rotation in degrees, multiples of 90"),
});

export const GeneratedPlanSchema = z.object({
  name: z.string().describe("Short name for the build, e.g. 'Double garage with workshop bay'"),
  shed: ShedSchema,
  openings: z.array(OpeningSchema),
  internalWalls: z
    .array(
      z.object({
        axis: z.enum(["across", "along"]).describe("across = runs side to side (parallel to the front wall). along = runs front to back."),
        pos: z.number().describe("mm from the middle of the building. across: positive = towards the front. along: positive = to the right when facing the front."),
        door: z.boolean().describe("Whether the wall has a doorway"),
        doorOffset: z.number().describe("Doorway centre in mm from the middle of the wall"),
      })
    )
    .describe("Full-span internal walls in an enclosed building, only when asked for or shown between rooms on a plan"),
  items: z.array(ItemSchema).describe("Things placed inside, only if asked for (car, workbench, shelving, mower)"),
  warnings: z.array(z.string()).describe("Short notes on anything asked for that this planner cannot draw, or assumptions made"),
});

export type GeneratedPlan = z.infer<typeof GeneratedPlanSchema>;

export const STRUCTURE_SYSTEM_PROMPT = `You design small framed structures for Australian tradies inside a 3D build planner.
The planner draws ONE rectangular timber structure of one of these types:
- enclosed: stick-framed walls all round with cladding, doors and windows, and optional full-span internal walls with doorways
- carport: posts and doubled beams carrying a gable, skillion or flat roof, open sides
- pergola: posts, beams and rafters, roofMat "none" for open rafters or a roof sheet if asked
- verandah: attached along one side of a house. Use roof "skillion" with the house on the high side; roofDir 270 puts the house at the back
- deck: raised timber floor (floor "timber", floorSheet "deck") with a balustrade, no roof
All types have a floor (slab, timber, pavers, gravel or none). It cannot draw L shapes, joined roofs, steel portal frames, mezzanines or partial-length internal walls. If asked for one of those, build the closest version and say so in warnings.

Rules:
- All sizes in millimetres. Width is the front wall. Length runs front to back.
- Sensible Australian defaults: 2400 mm walls for sheds and garages, 2700-3000 mm for workshops, 15 degree gable, 300 mm eaves, 90x45 studs at 600 centres, slab 100 mm with SL72 mesh, Colorbond corrugated walls in Surfmist and roof in Monument, unless the description says otherwise.
- Roller doors usually go on the front wall: 2400 wide x 2100 high for a single car, 3000 x 2700 for a workshop or caravan. A double garage gets two singles or one 4800 wide door.
- Personal access doors are 820 x 2040. Windows default 1200 x 600 with a 1200 sill.
- Keep every opening fully inside its wall, at least 200 mm from the corners, with at least 300 mm between openings on the same wall, and at least 250 mm below the top of the wall.
- Pick rafter size from the span: up to 3600 mm span 90x45, up to 6000 mm 140x45, wider 190x45.
- When a current design is given and the request reads like a change ("make it longer", "add a window"), keep everything else from the current design.
- Doors, windows and internal walls only apply to enclosed buildings. Leave openings and internalWalls empty for other types.
- Only add items when asked. Australian spelling.`;

/* ---------- normalisation ---------- */

const clamp = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : dflt;
  return Math.min(hi, Math.max(lo, n));
};
const r10 = (v: number) => Math.round(v / 10) * 10;

export interface PlannerShedPatch {
  [k: string]: string | number;
}

export interface NormalizedPlan {
  name: string;
  shed: PlannerShedPatch;
  openings: Array<{ type: string; wall: string; offset: number; width: number; height: number; sill: number; build: string }>;
  internalWalls: Array<{ axis: string; pos: number; door: boolean; doorOffset: number }>;
  items: Array<{ name: string; w: number; d: number; h: number; x: number; z: number; y: number; rot: number }>;
  warnings: string[];
}

/** Clamp the model's answer to the same ranges the planner's inputs enforce. */
export function normalizeGeneratedPlan(p: GeneratedPlan): NormalizedPlan {
  const s = p.shed;
  const width = r10(clamp(s.width, 1200, 15000, 3600));
  const length = r10(clamp(s.length, 1200, 30000, 6000));
  const height = r10(clamp(s.height, 1800, 6000, 2400));
  const roof = s.roof;
  let roofDir = Number(s.roofDir) || 0;
  if (roof === "gable") roofDir = roofDir % 180;

  const type = s.type ?? "enclosed";
  const shed: PlannerShedPatch = {
    type,
    width,
    length,
    height,
    roof,
    roofDir,
    pitch: Math.round(clamp(s.pitch, 2, 45, 15)),
    overhang: r10(clamp(s.overhang, 0, 900, 300)),
    studSize: s.studSize,
    studSpacing: Number(s.studSpacing),
    rafterSize: s.rafterSize,
    rafterSpacing: Number(s.rafterSpacing),
    floor: s.floor,
    wallMat: s.wallMat,
    roofMat: s.roofMat,
    wallColor: s.wallColor,
    roofColor: s.roofColor,
    doorColor: s.doorColor,
  };
  if (s.floor === "slab") {
    shed.slabT = Math.round(clamp(s.slabT ?? 100, 75, 200, 100) / 25) * 25;
    shed.mesh = s.mesh ?? "SL72";
  }
  if (s.floor === "timber") {
    shed.floorSheet = s.floorSheet ?? "yt";
    shed.floorH = r10(clamp(s.floorH ?? 350, 250, 1200, 350));
    shed.joistSpacing = shed.floorSheet === "ply" ? 600 : 450;
  }
  if (type === "deck") {
    shed.floor = "timber";
    shed.floorSheet = "deck";
    shed.joistSpacing = 450;
    shed.floorH = r10(clamp(s.floorH ?? 600, 250, 3000, 600));
  }
  if (shed.roofMat === "none" && type !== "pergola") shed.roofMat = "corr";
  if (type === "verandah") shed.roof = "skillion";
  if (s.floor === "pavers" && s.paverType) shed.paverType = s.paverType;
  if (s.floor === "gravel" && s.gravelType) shed.gravelType = s.gravelType;

  // Wall lengths in the planner's local frame: front/back run the width,
  // left/right run the length (the planner swaps these itself when a
  // roof direction rotates the building).
  const wallLen = (w: string) => (w === "front" || w === "back" ? width : length);
  const openings = (type === "enclosed" ? p.openings ?? [] : []).slice(0, 16).map((o) => {
    const len = wallLen(o.wall);
    const isWin = o.type === "window";
    const ow = r10(clamp(o.width, 300, Math.max(300, len - 400), isWin ? 1200 : 820));
    const maxH = height - 250 - (isWin ? clamp(o.sill, 0, height, 1200) : 0);
    const oh = r10(clamp(o.height, 300, Math.max(300, maxH), isWin ? 600 : 2040));
    const sill = isWin ? r10(clamp(o.sill, 0, Math.max(0, height - 250 - oh), 1200)) : 0;
    const maxOff = Math.max(0, len / 2 - ow / 2 - 200);
    const builds = OPENING_BUILDS[o.type] as readonly string[];
    return {
      type: o.type,
      wall: o.wall,
      offset: r10(clamp(o.offset, -maxOff, maxOff, 0)),
      width: ow,
      height: oh,
      sill,
      build: builds.includes(o.build) ? o.build : builds[0],
    };
  });

  const items = (p.items ?? []).slice(0, 24).map((i) => ({
    name: String(i.name || "Item").slice(0, 60),
    w: r10(clamp(i.w, 50, 12000, 1000)),
    d: r10(clamp(i.d, 50, 12000, 1000)),
    h: r10(clamp(i.h, 20, 5000, 1000)),
    x: r10(clamp(i.x, -width / 2, width / 2, 0)),
    z: r10(clamp(i.z, -length / 2, length / 2, 0)),
    y: 0,
    rot: (Math.round(clamp(i.rot, -360, 720, 0) / 90) * 90 + 360) % 360,
  }));

  const internalWalls = (type === "enclosed" ? p.internalWalls ?? [] : []).slice(0, 8).map((w) => {
    const across = w.axis !== "along";
    const span = across ? width : length;
    const depth = across ? length : width;
    const lim = Math.max(0, depth / 2 - 300);
    return {
      axis: across ? "across" : "along",
      pos: r10(clamp(w.pos, -lim, lim, 0)),
      door: w.door !== false,
      doorOffset: r10(clamp(w.doorOffset, -(span / 2 - 600), span / 2 - 600, 0)),
    };
  });

  return {
    name: String(p.name || "New build").slice(0, 80),
    shed,
    openings,
    internalWalls,
    items,
    warnings: (p.warnings ?? []).filter((w) => typeof w === "string" && w.trim()).slice(0, 6).map((w) => w.slice(0, 240)),
  };
}

/* ---------- read a plan drawing ---------- */

export const PlanReadSchema = GeneratedPlanSchema.extend({
  footprint: z.enum(["rectangle", "l_shape", "irregular"]).describe("Overall shape of the outside walls"),
  rooms: z
    .array(z.object({ name: z.string(), width: z.number().describe("mm"), length: z.number().describe("mm") }))
    .describe("Rooms or zones with their sizes in mm, as labelled on the plan"),
  confidence: z.enum(["high", "medium", "low"]).describe("How sure you are about the overall dimensions"),
});

export type PlanRead = z.infer<typeof PlanReadSchema>;

export const PLAN_READ_PROMPT = `${STRUCTURE_SYSTEM_PROMPT}

You are reading an uploaded drawing: a floor plan, site plan, shed kit drawing or a hand sketch.
- Use the written numbers, not pixel measurements. Whole numbers like "6000" or "3220 X 4640" are millimetres. Numbers with decimals like "3.3 x 3.2" are metres; convert them to millimetres.
- Many plans, especially sales and real estate plans, only label room sizes and have no overall dimension chains. That is enough: work out the overall size by adding up the rooms along each row and column of the plan. Room sizes are internal, so add about 90 mm for each internal wall and about 250 mm for each external wall (brick veneer) or 120 mm (lightweight cladding). Include the garage, laundry, robes and any unlabelled hallway in the footprint, estimating unlabelled areas from their size relative to labelled rooms.
- Ignore decks, alfresco areas, porches, driveways, sheds, trees and boundary lines outside the main enclosed building, and mention them in warnings.
- Width = the external dimension of the front wall. The front is the side with the street, the main entry, porch or garage door. Length = external dimension front to back.
- If the outline is L-shaped or irregular, use the bounding rectangle of the main enclosed area for width and length, and say so in warnings.
- Read wall height and roof pitch from elevations, sections or notes if shown. Otherwise use the defaults.
- Place every external door, window and roller door on the right wall. Window codes like "1218" usually mean 1200 high x 1810 wide, and "0909" 900 x 900. Measure each opening's offset from the middle of its wall using the dimension chains.
- List the rooms you can read with their sizes.
- For a house or studio, place internal walls along the main lines between rows of rooms (e.g. the wall between the bedroom wing and the living areas), each full span, with a doorway where the plan shows one. Skip short robe and ensuite walls. Add at most 6 internal walls.
- Set confidence to "medium" when the overall size came from adding up room sizes, "high" only when overall dimension chains are shown, and "low" only when there are no readable numbers at all. Always return your best estimate of the building, never an empty answer.`;

export function normalizePlanRead(p: PlanRead) {
  const base = normalizeGeneratedPlan(p);
  const rooms = (p.rooms ?? []).slice(0, 30).map((r) => ({
    name: String(r.name || "Room").slice(0, 40),
    width: Math.round(clamp(r.width, 0, 50000, 0) / 10) * 10,
    length: Math.round(clamp(r.length, 0, 50000, 0) / 10) * 10,
  }));
  const warnings = [...base.warnings];
  if (p.footprint !== "rectangle" && !warnings.some((w) => /shape|rectang/i.test(w))) {
    warnings.unshift(`The plan is ${p.footprint === "l_shape" ? "L-shaped" : "an irregular shape"}. The planner built the overall rectangle for now.`);
  }
  return { ...base, warnings: warnings.slice(0, 6), rooms, footprint: p.footprint, confidence: p.confidence };
}

/* ---------- trace mode: AI draft of a floor plan ---------- */

const pt = z.number().describe("0 to 1000 across or down the whole image");
export const TraceDraftSchema = z.object({
  outline: z
    .array(z.array(pt).describe("[x, y]"))
    .describe("Corners of the OUTSIDE face of the external walls of the main house, in order around the building. Square corners."),
  walls: z
    .array(z.array(pt).describe("[x1, y1, x2, y2]"))
    .describe("Internal walls as straight centrelines, each running end to end between the walls it meets"),
  rooms: z
    .array(z.object({ name: z.string(), width: z.number().describe("mm, from the label, 0 if none"), length: z.number().describe("mm, from the label, 0 if none"), x: pt, y: pt }))
    .describe("Every room with its label position and labelled size"),
  openings: z
    .array(z.object({ type: z.enum(["door", "window", "slider", "garage"]), x: pt, y: pt }))
    .describe("Doors and windows, positioned on the wall line they sit in"),
});
export type TraceDraft = z.infer<typeof TraceDraftSchema>;

export const TRACE_DRAFT_PROMPT = `You trace Australian floor plans for tradies who will check and correct your work.
Coordinates: x and y run from 0 to 1000 across the whole image (0,0 top left, 1000,1000 bottom right), whatever its shape.
- outline: the outside face of the external walls of the main house, garage included. Follow every step in and out. Leave out porches, alfresco, decks, driveways, sheds, fences and landscaping.
- walls: internal walls between rooms as straight centrelines. Make each wall run all the way to the walls it meets so rooms close off. Include robe and ensuite walls.
- rooms: one entry per labelled room, with the label text as the name, x and y at the centre of the label text itself. Sizes like "3220 X 4640" are mm; "3.3 x 3.2" are metres, so convert to mm. Also list labelled outdoor areas (deck, alfresco, verandah, porch, patio, driveway) the same way.
- openings: external doors, windows, sliding doors and garage doors, with internal doors, each positioned on its wall line.
Be precise: a trace that is out by 2% is far more useful than one that is out by 10%.`;

const c1000 = (v: unknown) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return Math.round(Math.min(1000, Math.max(0, n)) * 10) / 10;
};

export function normalizeTraceDraft(d: TraceDraft) {
  const outline = (d.outline ?? []).filter((p) => Array.isArray(p) && p.length >= 2).slice(0, 60).map((p) => [c1000(p[0]), c1000(p[1])]);
  const walls = (d.walls ?? [])
    .filter((w) => Array.isArray(w) && w.length >= 4)
    .slice(0, 80)
    .map((w) => [c1000(w[0]), c1000(w[1]), c1000(w[2]), c1000(w[3])])
    .filter((w) => Math.hypot(w[2] - w[0], w[3] - w[1]) > 3);
  const rooms = (d.rooms ?? []).slice(0, 40).map((r) => ({
    name: String(r.name || "Room").slice(0, 40),
    width: Math.round(Math.min(30000, Math.max(0, Number(r.width) || 0))),
    length: Math.round(Math.min(30000, Math.max(0, Number(r.length) || 0))),
    x: c1000(r.x),
    y: c1000(r.y),
  }));
  const openings = (d.openings ?? []).slice(0, 80).map((o) => ({ type: o.type, x: c1000(o.x), y: c1000(o.y) }));
  return { outline: outline.length >= 3 ? outline : [], walls, rooms, openings };
}
