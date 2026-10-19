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
  roofMat: z.enum(["corr", "trimdek", "zinc", "poly"]).describe("zinc = Zincalume corrugated, poly = clear polycarbonate"),
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
  items: z.array(ItemSchema).describe("Things placed inside, only if asked for (car, workbench, shelving, mower)"),
  warnings: z.array(z.string()).describe("Short notes on anything asked for that this planner cannot draw, or assumptions made"),
});

export type GeneratedPlan = z.infer<typeof GeneratedPlanSchema>;

export const STRUCTURE_SYSTEM_PROMPT = `You design small framed structures for Australian tradies inside a 3D build planner.
The planner draws ONE rectangular, fully enclosed, timber stick-framed building with a gable, skillion or flat roof, clad walls, doors and windows, and a floor (slab, timber, pavers, gravel or none).
It cannot yet draw open-sided structures (carports, pergolas, verandahs), decks without walls, multiple rooms, internal walls, L shapes, steel portal frames, mezzanines or attached lean-tos against a house. If asked for one of those, build the closest enclosed version and say so in warnings.

Rules:
- All sizes in millimetres. Width is the front wall. Length runs front to back.
- Sensible Australian defaults: 2400 mm walls for sheds and garages, 2700-3000 mm for workshops, 15 degree gable, 300 mm eaves, 90x45 studs at 600 centres, slab 100 mm with SL72 mesh, Colorbond corrugated walls in Surfmist and roof in Monument, unless the description says otherwise.
- Roller doors usually go on the front wall: 2400 wide x 2100 high for a single car, 3000 x 2700 for a workshop or caravan. A double garage gets two singles or one 4800 wide door.
- Personal access doors are 820 x 2040. Windows default 1200 x 600 with a 1200 sill.
- Keep every opening fully inside its wall, at least 200 mm from the corners, with at least 300 mm between openings on the same wall, and at least 250 mm below the top of the wall.
- Pick rafter size from the span: up to 3600 mm span 90x45, up to 6000 mm 140x45, wider 190x45.
- When a current design is given and the request reads like a change ("make it longer", "add a window"), keep everything else from the current design.
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

  const shed: PlannerShedPatch = {
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
  if (s.floor === "pavers" && s.paverType) shed.paverType = s.paverType;
  if (s.floor === "gravel" && s.gravelType) shed.gravelType = s.gravelType;

  // Wall lengths in the planner's local frame: front/back run the width,
  // left/right run the length (the planner swaps these itself when a
  // roof direction rotates the building).
  const wallLen = (w: string) => (w === "front" || w === "back" ? width : length);
  const openings = (p.openings ?? []).slice(0, 16).map((o) => {
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

  return {
    name: String(p.name || "New build").slice(0, 80),
    shed,
    openings,
    items,
    warnings: (p.warnings ?? []).filter((w) => typeof w === "string" && w.trim()).slice(0, 6).map((w) => w.slice(0, 240)),
  };
}
