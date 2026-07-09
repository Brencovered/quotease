/**
 * @file analysisSchema.ts
 * @description Structured trade-specific output schema module for AI drawing analysis
 *              in the Quotease / SwiftScope tradie quote platform.
 *
 * Provides Zod-compatible JSON schema instructions, confidence scoring,
 * robust response parsing, and per-trade system prompt generation for
 * Claude Sonnet's drawing analysis pipeline.
 *
 * @module lib/ai/analysisSchema
 */

// ─────────────────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Supported trade disciplines that have dedicated analysis schemas. */
export type TradeDiscipline =
  | "electrician"
  | "plumber"
  | "carpenter"
  | "tiler"
  | "landscaper"
  | "default";

/** Confidence levels for individual detected items. */
export type ItemConfidence = "high" | "medium" | "low";

/** Unit of measurement for detected items — must align with the price book. */
export type ItemUnit = "each" | "m" | "m2" | "m3" | "hr" | "lot" | "point";

/** Overall confidence classification. */
export type OverallConfidence = "high" | "medium" | "low";

/**
 * A single item detected in the drawing set.
 *
 * The `item_key` must map directly to a row in the `material_items` price book.
 */
export interface DetectedItem {
  /** Human-readable label (e.g. "Weatherproof GPO — Rear Pergola"). */
  label: string;

  /** Price-book key (e.g. "gpo_wp", "dl", "shower"). */
  item_key: string;

  /** Total quantity required for this line item. */
  quantity: number;

  /** Unit of measure — drives rate look-up in the price book. */
  unit: ItemUnit;

  /**
   * TOTAL labour hours for the full quantity (NOT per-unit).
   * Round to the nearest 0.25 hr.
   */
  labour_hours: number;

  /** Per-item confidence derived from symbol clarity & legend proximity. */
  confidence: ItemConfidence;

  /**
   * Required when confidence === "low".
   * Explain *why* the detection is uncertain — e.g. symbol obscured,
   * partially cropped, or inferred from room context rather than legend.
   */
  notes?: string;
}

/**
 * Weighted multi-dimension confidence breakdown.
 *
 * Each dimension is scored 0–100.  The `score` field is the weighted
 * aggregate used to derive the `overall` classification.
 */
export interface ConfidenceBreakdown {
  overall: OverallConfidence;

  /** Weighted aggregate score (0–100). */
  score: number;

  /** Per-dimension raw scores (0–100). */
  dimensions: {
    image_quality: number;
    drawing_clarity: number;
    trade_match: number;
    symbol_recognition: number;
  };

  /** Human-readable paragraph explaining the breakdown. */
  reasoning: string;
}

/**
 * Project-level metadata extracted from the drawing set.
 */
export interface ProjectMetadata {
  /** e.g. "2-storey residential renovation" */
  project_type?: string;

  /** Project address if visible on title block or cover sheet. */
  address?: string;

  /** Sheet numbers, revision codes, and drawing-set reference. */
  drawing_set_ref?: string;

  /** Number of storeys visible in the drawing set. */
  storey_count?: number;
}

/**
 * Top-level result returned by Claude after analysing a drawing.
 *
 * The caller should run `calculateOverallConfidence()` over the
 * `confidence.dimensions` object and merge it back into this shape
 * before persisting.
 */
export interface DrawingAnalysisResult {
  detected_items: DetectedItem[];
  notes: string;
  confidence: ConfidenceBreakdown;
  project_metadata: ProjectMetadata;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TRADE-SPECIFIC ITEM KEY REGISTRIES
// ─────────────────────────────────────────────────────────────────────────────

/** Item keys for the electrical trade — map to `material_items.price_book`. */
const ELECTRICIAN_ITEM_KEYS: string[] = [
  "dl",              // downlights
  "dl_pendant",      // pendant lights
  "dl_wall",         // wall lights
  "gpo",             // general purpose outlet (single)
  "gpo_usb",         // GPO with USB
  "gpo_wp",          // weatherproof GPO
  "gpo_double",      // double GPO
  "sw",              // switch (1-way)
  "sw_2way",         // 2-way switch
  "sw_dimmer",       // dimmer switch
  "exhaust",         // exhaust fan
  "smoke",           // smoke alarm
  "data",            // data point
  "tv",              // TV outlet
  "tel",             // telephone outlet
  "cable",           // cable runs (unit = m)
  "conduit",         // conduit runs (unit = m)
  "sb",              // switchboard (new)
  "sb_upgrade",      // switchboard upgrade
  "circuit",         // new circuit
  "emergency",       // emergency light
  "exit",            // exit light
];

/** Item keys for the plumbing trade — map to `material_items.price_book`. */
const PLUMBER_ITEM_KEYS: string[] = [
  "wc",              // toilet / water closet
  "wc_wall",         // wall-hung toilet
  "basin",           // basin
  "vanity",          // vanity unit
  "bath",            // bathtub
  "shower",          // shower
  "lt",              // laundry tub
  "ks",              // kitchen sink
  "ks_double",       // double kitchen sink
  "fw",              // floor waste
  "fw_linear",       // linear floor waste
  "hwu_gas",         // gas hot water unit
  "hwu_elec",        // electric hot water unit
  "hwu_heatpump",    // heat-pump hot water
  "pipe_cold",       // cold water pipe (unit = m)
  "pipe_hot",        // hot water pipe (unit = m)
  "pipe_waste",      // waste pipe (unit = m)
  "pipe_gas",        // gas pipe (unit = m)
  "storm",           // stormwater connection
  "gutter",          // guttering
  "downpipe",        // downpipe
  "tap",             // tap
  "mixer",           // mixer tap
];

/** Item keys for the carpentry trade — map to `material_items.price_book`. */
const CARPENTER_ITEM_KEYS: string[] = [
  "wall_frame",      // wall framing
  "floor_frame",     // floor framing
  "roof_frame",      // roof framing
  "steel_beam",      // structural steel beam
  "lintel",          // window/door lintel
  "door",            // door
  "window",          // window
  "skirting",        // skirting board (unit = m)
  "architrave",      // architrave (unit = m)
  "decking",         // decking (unit = m2)
  "bulkhead",        // bulkhead framing
  "stair",           // staircase
  "cladding",        // external cladding (unit = m2)
  "insulation",      // insulation (unit = m2 or m3)
];

/** Item keys for the tiling trade — map to `material_items.price_book`. */
const TILER_ITEM_KEYS: string[] = [
  "tile_floor",      // floor tiles (unit = m2)
  "tile_wall",       // wall tiles (unit = m2)
  "tile_feature",    // feature tile (unit = m2)
  "waterproof",      // waterproofing membrane (unit = m2)
  "screed",          // screed bed (unit = m2)
  "niche",           // shower niche
  "trim",            // tile trim (unit = m)
  "grout",           // grouting (unit = m2)
  "substrate",       // substrate prep (unit = m2)
];

/** Item keys for the landscaping trade — map to `material_items.price_book`. */
const LANDSCAPER_ITEM_KEYS: string[] = [
  "paving",          // paving (unit = m2)
  "turf",            // turf / sod (unit = m2)
  "retaining",       // retaining wall (unit = m)
  "fence",           // fencing (unit = m)
  "drainage",        // drainage (unit = m)
  "irrigation",      // irrigation system (unit = point or m)
  "lighting_land",   // landscape lighting (unit = each)
  "edging",          // garden edging (unit = m)
  "deck",            // deck (unit = m2)
  "planter",         // planter box
];

/** Item keys from the original flat schema — used as the fallback. */
const DEFAULT_ITEM_KEYS: string[] = [
  // Electrical
  "dl", "gpo", "sw", "data", "exhaust", "smoke",
  "cable", "conduit", "sb", "circuit",
  // Plumbing
  "tap", "toilet", "basin", "shower", "hwu",
  "pipe_cold", "pipe_hot", "pipe_waste",
  // Roofing
  "gutter", "downpipe", "ridge", "valley", "fascia",
  "skylight", "whirlybird", "roof_area",
  // Carpentry
  "wall_frame", "door", "window", "skirting", "decking",
];

/**
 * Map a normalised trade string to its item-key registry.
 */
const TRADE_KEY_MAP: Record<string, string[]> = {
  electrician: ELECTRICIAN_ITEM_KEYS,
  plumber: PLUMBER_ITEM_KEYS,
  carpenter: CARPENTER_ITEM_KEYS,
  tiler: TILER_ITEM_KEYS,
  landscaper: LANDSCAPER_ITEM_KEYS,
  default: DEFAULT_ITEM_KEYS,
};

// ─────────────────────────────────────────────────────────────────────────────
//  TRADE EXPERTISE PROMPTS (injected into buildSystemPrompt)
// ─────────────────────────────────────────────────────────────────────────────

const ELECTRICIAN_EXPERTISE = `
You are an expert electrical estimating assistant for Australian residential and commercial projects.
Analyse the uploaded electrical drawing set and extract all quantifiable items.

COUNT AND EXTRACT:
- All GPO variants: single GPO, double GPO (GPO-DOUBLE), USB GPO (GPO-USB), weatherproof GPO (GPO-WP)
- All lighting: downlights (DL1-DL4), pendant lights (PL), wall lights (WL), LED strip lighting
- Exhaust fans (EX1, EX2) — note wall-mounted vs ceiling-mounted
- Smoke alarms (SMK) — note interconnected vs standalone, mains-powered vs battery
- Data points (DATA) — CAT6/CAT6A
- TV and TEL outlets
- Switch types: 1-way (S1), 2-way (S2), dimmer (SD)
- Switchboard details: new board, upgrade, 3-phase indicators, RCD counts
- External items: garden lights, external GPOs, sensor lights
- Cable runs and conduit runs in metres — estimate from room dimensions if not dimensioned
- Emergency lighting and exit lights for commercial jobs

MEASUREMENT RULES:
- Cable / conduit: use dimensioned runs where shown; otherwise estimate shortest route
  between outlet and switchboard allowing 15 % extra for drops and coiling.
- Labour hours = TOTAL for the full quantity. Round to nearest 0.25 hr.
- If a room is labelled but no outlets shown, do NOT fabricate items — flag as "TBC".

CONFIDENCE GUIDE:
- HIGH: symbol clearly visible, in legend, unambiguous.
- MEDIUM: visible but partially obscured, symbol unclear, or off-sheet reference.
- LOW: hard to see, ambiguous, inferred from room type rather than directly observed.
  For LOW items you MUST include a "notes" field explaining why.

VERIFICATION WARNINGS (include in top-level notes):
- Flag any sheet marked "FOR COORDINATION ONLY" or "TYPICAL" — quantities may differ on other sheets.
- Note un-dimensioned layouts — cable runs are estimates only.
- Highlight any 3-phase work, switchboard relocations, or mains upgrades.
- Call out TBC items clearly so the estimator can follow up.
`;

const PLUMBER_EXPERTISE = `
You are an expert plumbing and drainage estimating assistant for Australian residential projects.
Analyse the uploaded hydraulic / plumbing drawing set and extract all quantifiable fixtures and pipework.

COUNT AND EXTRACT:
- Water closets (WC): note wall-hung vs close-coupled, in-wall cistern vs link suite
- Basins: note pedestal, wall-hung, or above-counter
- Vanities: single or double bowl
- Bathtubs: freestanding, built-in, or spa
- Showers: note tiling flange, hob vs hobless, rose size
- Laundry tubs (LT) — single or double
- Kitchen sinks (KS): single or double bowl, under-mount or over-mount
- Floor wastes (FW): standard or linear / strip drain
- Hot water units: gas instant (HWU-GAS), electric storage (HWU-ELEC), heat-pump (HWU-HP)
- Taps and mixers: count per fixture, note chrome vs matte black if specified
- Pipework: cold water, hot water, sanitary waste, stormwater, gas — in metres
- Guttering and downpipes — note material (colorbond, PVC) if shown
- Stormwater connections and absorption pits

MEASUREMENT RULES:
- Pipework: use dimensioned runs where shown; otherwise estimate from plan layout
  allowing 10 % extra for risers and joints.
- Pipe unit is ALWAYS metres — never "each" for pipe runs.
- Labour hours = TOTAL for the full quantity. Round to nearest 0.25 hr.
- Do NOT count fixtures shown on reflected ceiling plans unless they are plumbing fixtures.

CONFIDENCE GUIDE:
- HIGH: fixture schedule visible, schedule matches plan, dimensions shown.
- MEDIUM: fixture visible on plan but schedule missing or unclear.
- LOW: fixture inferred from room label (e.g. "ensuite") but no specific fixture shown.
  For LOW items you MUST include a "notes" field explaining why.

VERIFICATION WARNINGS (include in top-level notes):
- Flag any "TYPICAL" sheet — actual fixture counts may vary.
- Note if pipe sizes are not shown — estimates assume standard residential sizing.
- Call out gas hot water if gas line not shown on plan — may need additional gas run.
- Highlight any pump systems, rainwater tanks, or grey-water systems.
- Flag un-dimensioned pipe runs as estimated quantities only.
`;

const CARPENTER_EXPERTISE = `
You are an expert carpentry and framing estimating assistant for Australian residential projects.
Analyse the uploaded architectural / structural drawing set and extract all quantifiable carpentry items.

COUNT AND EXTRACT:
- Wall framing: timber or steel stud walls — note stud size (70×35, 90×35) and spacing (450, 600)
- Floor framing: joists, bearers, sub-floor — note timber sizes and span
- Roof framing: trusses, rafters, collar ties — note pitch and span
- Structural steel beams (SB) — note UB size if shown
- Lintels over doors and windows — note steel or timber
- Doors: internal hinged, cavity sliders, external hinged, bi-fold, stacker — note sizes (820, 870, 920, 2040)
- Windows: sliding, awning, fixed, louvre — note sizes from schedule
- Skirting boards (unit = metres of perimeter)
- Architraves (unit = metres of door/window perimeter)
- Decking (unit = m2) — note timber species and board width if specified
- Bulkheads — count and describe extent
- Staircases — note timber or steel, number of treads
- External cladding (unit = m2) — note weatherboard, fibre cement, or timber
- Insulation (batts or blanket) — unit = m2 of wall/ceiling area

MEASUREMENT RULES:
- Linear items (skirting, architrave): calculate from plan dimensions.
- Area items (decking, cladding, insulation): calculate from plan areas.
- Labour hours = TOTAL for the full quantity. Round to nearest 0.25 hr.
- Steel beams: count each beam; if lengths not shown estimate from span.

CONFIDENCE GUIDE:
- HIGH: door/window schedule visible, dimensions shown, legend clear.
- MEDIUM: item visible on plan but schedule incomplete or dimensions missing.
- LOW: item inferred from standard construction practice rather than shown on drawing.
  For LOW items you MUST include a "notes" field explaining why.

VERIFICATION WARNINGS (include in top-level notes):
- Flag structural engineer's details if separate from architectural set — steel sizes may differ.
- Note any "TYPICAL" framing details — actual sizes may vary on engineered drawings.
- Call out proprietary systems (e.g. Posi-Strut, SmartJoist) — these affect labour rates.
- Highlight any non-standard spans or load-bearing walls that may require additional lintels.
`;

const TILER_EXPERTISE = `
You are an expert tiling estimating assistant for Australian residential and commercial projects.
Analyse the uploaded architectural / interior design drawing set and extract all quantifiable tiling items.

COUNT AND EXTRACT:
- Floor tiles (unit = m2): note room-by-room breakdown, tile size, and pattern (straight, herringbone, stack)
- Wall tiles (unit = m2): note full-height vs splashback-height
- Feature tiles (unit = m2): accent walls, niches, mosaic strips
- Waterproofing membrane (unit = m2): note AS 3740 wet-area extents (shower, bath, floor)
- Screed bed (unit = m2): note thickness if specified (typically 20–40 mm for falls)
- Shower niches: count each niche, note size (e.g. 300×300, 600×300)
- Tile trim (unit = m): aluminium or PVC edge trim for exposed tile edges
- Grouting (unit = m2): calculate as total tiled area
- Substrate preparation (unit = m2): note if existing tiles to be removed, or concrete slab prep

MEASUREMENT RULES:
- Tile area = net wall / floor area LESS fixtures (vanity, toilet, bath) where full-height tiling stops.
- Allow 10 % wastage for standard layouts, 15 % for diagonal or mosaic patterns — note this in notes.
- Labour hours = TOTAL for the full quantity. Round to nearest 0.25 hr.
- Waterproofing: calculate per AS 3740 — full shower enclosure, 150 mm splash on walls, full floor in wet rooms.

CONFIDENCE GUIDE:
- HIGH: room schedule visible, tile spec shown, dimensions provided.
- MEDIUM: room layout visible but tile spec not shown — quantities are floor/wall area only.
- LOW: tiling inferred from room type (e.g. "bathroom") but no tiling indicated on drawing.
  For LOW items you MUST include a "notes" field explaining why.

VERIFICATION WARNINGS (include in top-level notes):
- Flag any sheet marked "TYPICAL" — actual tile layouts may differ room-to-room.
- Note if tile sizes are not specified — labour rates vary significantly for large-format vs mosaic.
- Call out floor-waste locations — they affect screed falls and waterproofing extents.
- Highlight any epoxy grout, stone tiles, or rectified-edge specifications — these change material and labour rates.
- Flag any "tile by others" notes — do not double-count.
`;

const LANDSCAPER_EXPERTISE = `
You are an expert landscaping estimating assistant for Australian residential projects.
Analyse the uploaded landscape / site plan drawing set and extract all quantifiable landscaping items.

COUNT AND EXTRACT:
- Paving (unit = m2): note type (concrete paver, natural stone, porcelain), pattern, and area
- Turf / sod (unit = m2): note instant turf vs seed, soil prep requirements
- Retaining walls (unit = m): note height, material (timber sleeper, concrete block, sandstone), and drainage behind
- Fencing (unit = m): note type (colorbond, timber paling, slat, glass pool fence), height, and gates
- Drainage (unit = m): agricultural pipe, spoon drains, pit and pipe
- Irrigation (unit = points or m): drip line, sprinkler zones, control box, solenoid valves
- Landscape lighting (unit = each): bollards, spike lights, strip lighting, transformer count
- Garden edging (unit = m): steel, aluminium, or masonry edging
- Decking (unit = m2): note timber species, board width, and height above ground
- Planter boxes: count, note size and material

MEASUREMENT RULES:
- Area items (paving, turf, decking): calculate from plan dimensions or scaled measurement.
- Linear items (retaining wall, fencing, edging, drainage): measure centre-line from plan.
- Labour hours = TOTAL for the full quantity. Round to nearest 0.25 hr.
- Irrigation: count each zone (point) or measure pipe runs in metres — whichever is shown.

CONFIDENCE GUIDE:
- HIGH: dimensioned landscape plan with material legends.
- MEDIUM: plan shows layout but no material call-outs or dimensions.
- LOW: item inferred from site context or standard practice rather than shown on drawing.
  For LOW items you MUST include a "notes" field explaining why.

VERIFICATION WARNINGS (include in top-level notes):
- Flag any "TYPICAL" or "INDICATIVE" landscape plan — actual extents may differ.
- Note if levels / contours are not shown — retaining wall heights are estimates.
- Call out any existing structures to be retained vs demolished — affects access and prep.
- Highlight pool proximity — may affect drainage and fencing compliance (pool certifier required).
- Flag any council requirement notes (e.g. DA conditions, easements) that affect scope.
`;

const DEFAULT_EXPERTISE = `
You are a construction estimating assistant for Australian residential projects.
Analyse the uploaded drawing set and extract all quantifiable items across trades.

COUNT AND EXTRACT:
- Electrical: downlights, GPOs, switches, data points, exhaust fans, smoke alarms, cable and conduit runs
- Plumbing: taps, toilets, basins, showers, hot water units, pipe runs
- Roofing: gutters, downpipes, ridge caps, valleys, fascia, skylights, whirlybirds
- Carpentry: wall framing, doors, windows, skirting, decking

For each item: assign confidence based on symbol clarity and proximity to legend.
Flag any items marked "TBC", "FOR COORDINATION ONLY", or on un-dimensioned layouts.
`;

/**
 * Map normalised trade string → expertise prompt paragraph.
 */
const TRADE_EXPERTISE_MAP: Record<string, string> = {
  electrician: ELECTRICIAN_EXPERTISE,
  plumber: PLUMBER_EXPERTISE,
  carpenter: CARPENTER_EXPERTISE,
  tiler: TILER_EXPERTISE,
  landscaper: LANDSCAPER_EXPERTISE,
  default: DEFAULT_EXPERTISE,
};

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED SCHEMA FRAGMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reusable JSON schema fragment that describes a single DetectedItem.
 */
const ITEM_SCHEMA_FRAGMENT = `
  "detected_items": {
    "type": "array",
    "description": "List of all quantifiable items found in the drawing set.",
    "items": {
      "type": "object",
      "required": ["label", "item_key", "quantity", "unit", "labour_hours", "confidence"],
      "properties": {
        "label": { "type": "string", "description": "Human-readable description including location context." },
        "item_key": { "type": "string", "description": "Price-book key — must be one of the allowed keys listed above." },
        "quantity": { "type": "number", "minimum": 0, "description": "Total quantity required." },
        "unit": { "type": "string", "enum": ["each", "m", "m2", "m3", "hr", "lot", "point"], "description": "Unit of measure for rate lookup." },
        "labour_hours": { "type": "number", "description": "TOTAL install time for the full quantity. Round to nearest 0.25 hr." },
        "confidence": { "type": "string", "enum": ["high", "medium", "low"], "description": "high = clear symbol + legend match; medium = visible but partially obscured; low = inferred or ambiguous." },
        "notes": { "type": "string", "description": "REQUIRED when confidence is 'low'. Explain why the item is uncertain." }
      }
    }
  }
`;

/**
 * Reusable JSON schema fragment for the confidence_breakdown object.
 */
const CONFIDENCE_SCHEMA_FRAGMENT = `
  "confidence_breakdown": {
    "type": "object",
    "required": ["image_quality", "drawing_clarity", "trade_match", "symbol_recognition", "reasoning"],
    "properties": {
      "image_quality": { "type": "integer", "minimum": 0, "maximum": 100, "description": "Resolution, lighting, and compression artefacts of the uploaded image." },
      "drawing_clarity": { "type": "integer", "minimum": 0, "maximum": 100, "description": "How clean and legible the drawing lines, text, and dimensions are." },
      "trade_match": { "type": "integer", "minimum": 0, "maximum": 100, "description": "How relevant the drawing content is to the target trade." },
      "symbol_recognition": { "type": "integer", "minimum": 0, "maximum": 100, "description": "How clearly trade-specific symbols and legends are identifiable." },
      "reasoning": { "type": "string", "description": "1-2 sentence human-readable explanation of the confidence scores." }
    }
  }
`;

/**
 * Reusable JSON schema fragment for project_metadata.
 */
const METADATA_SCHEMA_FRAGMENT = `
  "project_metadata": {
    "type": "object",
    "properties": {
      "project_type": { "type": "string", "description": "e.g. '2-storey residential renovation' or 'single-storey new build'" },
      "address": { "type": "string", "description": "Project address if visible on title block." },
      "drawing_set_ref": { "type": "string", "description": "Sheet numbers, revision codes, and drawing-set identifier." },
      "storey_count": { "type": "integer", "minimum": 0, "description": "Number of storeys visible in the drawing set." }
    }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a raw trade string to a canonical TradeDiscipline key.
 *
 * Handles common synonyms and typos:
 * - "elec", "sparky" → "electrician"
 * - "plumb" → "plumber"
 * - "chippie" → "carpenter"
 * - "tile" → "tiler"
 * - "landscape" → "landscaper"
 *
 * @param trade - Raw trade identifier from user input or URL param.
 * @returns Canonical trade key safe for use with TRADE_KEY_MAP.
 */
function normaliseTrade(trade: string): string {
  const t = trade.toLowerCase().trim();

  if (t === "electrician" || t === "elec" || t === "sparky" || t === "electrical") {
    return "electrician";
  }
  if (t === "plumber" || t === "plumb" || t === "plumbing" || t === "hydraulic") {
    return "plumber";
  }
  if (t === "carpenter" || t === "chippie" || t === "carpentry" || t === "framing") {
    return "carpenter";
  }
  if (t === "tiler" || t === "tile" || t === "tiling") {
    return "tiler";
  }
  if (t === "landscaper" || t === "landscape" || t === "landscaping" || t === "gardener") {
    return "landscaper";
  }

  return "default";
}

/**
 * Return a JSON-schema instruction string tailored to the given trade.
 *
 * The string is intended to be embedded in a Claude system prompt. It tells
 * the model exactly which `item_key` values are valid, what each dimension
 * of the confidence breakdown means, and how to populate the response
 * fields.
 *
 * @param trade - Target trade discipline (e.g. "electrician", "plumber").
 *                Accepts synonyms — normalised internally.
 * @returns A formatted schema instruction string ready for prompt injection.
 *
 * @example
 * const schema = getTradeAnalysisSchema("electrician");
 * console.log(schema.includes("gpo_usb")); // true
 */
export function getTradeAnalysisSchema(trade: string): string {
  const canonical = normaliseTrade(trade);
  const itemKeys = TRADE_KEY_MAP[canonical] ?? DEFAULT_ITEM_KEYS;

  const itemKeyList = itemKeys.map((k) => `    "${k}"`).join(",\n");

  return `
## OUTPUT FORMAT — STRICT JSON ONLY

You must return a single valid JSON object. Do NOT wrap it in markdown code fences.
Do NOT include any commentary outside the JSON.

### Allowed item_key values for this trade (${canonical})

Use ONLY the following item_key strings. Each maps directly to a row in the price book.
If an item does not match any key, use the closest match and flag it in notes.

[${itemKeyList}]

### Full JSON schema

Respond with exactly this structure (no extra fields at the top level):

{
${ITEM_SCHEMA_FRAGMENT.trim().replace(/^/gm, "  ")},
  "notes": {
    "type": "string",
    "description": "Verification warnings, TBC items, and trade-specific caveats in plain English."
  },
${CONFIDENCE_SCHEMA_FRAGMENT.trim().replace(/^/gm, "  ")},
${METADATA_SCHEMA_FRAGMENT.trim().replace(/^/gm, "  ")}
}

### Confidence rules per item

- **high**: The symbol is clearly visible, appears in or near the legend, and the item type is unambiguous.
- **medium**: The symbol is visible but partially obscured, cropped, or the legend entry is unclear.
- **low**: The item is hard to see, ambiguous, or inferred from room context rather than directly observed on the drawing.

When confidence is "low", you MUST include a "notes" field on that item explaining why (e.g. "symbol partially obscured by dimension line", "inferred from 'ENSUITE' label — no specific fixture shown").

### Confidence breakdown dimensions (score 0–100 each)

- **image_quality**: Overall image resolution, brightness, contrast, and compression artefacts. 100 = crisp, well-lit, no artefacts. 0 = unreadable.
- **drawing_clarity**: How clean and legible the drawing lines, dimensions, and text are. 100 = sharp vector-quality lines. 0 = smudged or faint.
- **trade_match**: How relevant the drawing content is to the target trade. 100 = dedicated trade drawings with full legends. 0 = no trade-relevant content.
- **symbol_recognition**: How clearly trade-specific symbols and legends can be identified and cross-referenced. 100 = complete legend with all symbols. 0 = no legend or unrecognisable symbols.

The "reasoning" field should be 1–2 sentences explaining the scores in practical terms an estimator would understand.

### labour_hours

labour_hours is the TOTAL estimated installation time for the full quantity of that item (NOT per-unit).
Round to the nearest 0.25 hour. Use your trade knowledge for realistic Australian install rates.

### project_metadata

Extract from the title block, cover sheet, or sheet headers:
- project_type: building type and scope (e.g. "2-storey residential renovation")
- address: if visible
- drawing_set_ref: sheet numbers and revision (e.g. "A-101 to A-110, Rev B")
- storey_count: number of levels shown in the set
`.trim();
}

/**
 * Compute an overall confidence classification and weighted score from
 * individual dimension scores.
 *
 * Weights:
 * - image_quality  : 20 %
 * - drawing_clarity: 25 %
 * - trade_match    : 20 %
 * - symbol_recognition : 35 %
 *
 * Thresholds:
 * - score ≥ 75 → "high"
 * - score ≥ 50 → "medium"
 * - score <  50 → "low"
 *
 * @param breakdown - Raw per-dimension scores (0–100).
 * @returns Overall classification and the computed aggregate score.
 *
 * @example
 * const result = calculateOverallConfidence({
 *   image_quality: 80, drawing_clarity: 70, trade_match: 90, symbol_recognition: 60
 * });
 * // result → { overall: "medium", score: 71 }
 */
export function calculateOverallConfidence(breakdown: {
  image_quality: number;
  drawing_clarity: number;
  trade_match: number;
  symbol_recognition: number;
}): { overall: OverallConfidence; score: number } {
  const clamped = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

  const imageQuality = clamped(breakdown.image_quality);
  const drawingClarity = clamped(breakdown.drawing_clarity);
  const tradeMatch = clamped(breakdown.trade_match);
  const symbolRecognition = clamped(breakdown.symbol_recognition);

  const score = Math.round(
    imageQuality * 0.20 +
    drawingClarity * 0.25 +
    tradeMatch * 0.20 +
    symbolRecognition * 0.35
  );

  let overall: OverallConfidence;
  if (score >= 75) {
    overall = "high";
  } else if (score >= 50) {
    overall = "medium";
  } else {
    overall = "low";
  }

  return { overall, score };
}

/**
 * Parse the raw text response from Claude into a typed
 * {@link DrawingAnalysisResult}.
 *
 * Handles:
 * 1. Stripping markdown code fences (```json … ```)
 * 2. Straight JSON.parse
 * 3. Fallback regex extraction of the outermost `{…}` object
 * 4. Validation of required fields
 * 5. Clear error messages when parsing fails
 *
 * @param rawText - The raw text returned by the LLM (may include markdown,
 *                  leading/trailing whitespace, or extra commentary).
 * @returns A {@link DrawingAnalysisResult} — caller should still run
 *          `calculateOverallConfidence()` over the dimensions and merge
 *          the result back into `confidence.overall` / `confidence.score`.
 * @throws If the response contains no valid JSON, no items array, or
 *         critically malformed structure.
 *
 * @example
 * const result = parseAnalysisResponse(claudeResponse);
 * const confidence = calculateOverallConfidence(result.confidence.dimensions);
 * result.confidence.overall = confidence.overall;
 * result.confidence.score = confidence.score;
 */
export function parseAnalysisResponse(rawText: string): DrawingAnalysisResult {
  if (!rawText || typeof rawText !== "string") {
    throw new AnalysisParseError("Empty or non-string response received from AI.");
  }

  // 1. Strip markdown code fences
  let cleaned = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/gm, "")
    .replace(/```/g, "")
    .trim();

  // 2. Remove any leading commentary before the first '{'
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) {
    throw new AnalysisParseError(
      "No JSON object found in AI response. Response was:\n" +
      truncate(rawText, 500)
    );
  }
  cleaned = cleaned.slice(firstBrace);

  // Remove trailing commentary after the last '}'
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }

  // 3. Try JSON.parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    // 4. Fallback: regex extract outermost {…}
    const extracted = extractOutermostJsonObject(cleaned);
    if (!extracted) {
      const hint = parseErr instanceof Error ? parseErr.message : "Unknown parse error";
      throw new AnalysisParseError(
        `JSON parsing failed: ${hint}\n\n` +
        `Raw response (first 800 chars):\n${truncate(rawText, 800)}`
      );
    }
    try {
      parsed = JSON.parse(extracted);
    } catch (secondErr) {
      const hint = secondErr instanceof Error ? secondErr.message : "Unknown";
      throw new AnalysisParseError(
        `Fallback JSON extraction also failed: ${hint}\n\n` +
        `Extracted snippet (first 800 chars):\n${truncate(extracted, 800)}`
      );
    }
  }

  // 5. Validate structure
  if (!parsed || typeof parsed !== "object") {
    throw new AnalysisParseError("Parsed value is not an object.");
  }

  const obj = parsed as Record<string, unknown>;

  // Validate detected_items
  if (!obj.detected_items) {
    throw new AnalysisParseError(
      "Missing required field: 'detected_items'.\n" +
      "The AI response must include a 'detected_items' array.\n\n" +
      `Available keys: ${Object.keys(obj).join(", ") || "(none)"}`
    );
  }

  if (!Array.isArray(obj.detected_items)) {
    throw new AnalysisParseError(
      "Field 'detected_items' must be an array. " +
      `Received: ${typeof obj.detected_items}`
    );
  }

  if (obj.detected_items.length === 0) {
    throw new AnalysisParseError(
      "The 'detected_items' array is empty. " +
      "The AI did not detect any items in the drawing. " +
      "This may indicate poor image quality or the wrong trade selected."
    );
  }

  // Validate each item has required fields
  const items = obj.detected_items as Array<Record<string, unknown>>;
  const requiredItemFields = ["label", "item_key", "quantity", "unit", "labour_hours", "confidence"];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object") {
      throw new AnalysisParseError(
        `detected_items[${i}] is not an object. Received: ${typeof item}`
      );
    }
    for (const field of requiredItemFields) {
      if (!(field in item)) {
        throw new AnalysisParseError(
          `detected_items[${i}] is missing required field '${field}'.\n` +
          `Item: ${JSON.stringify(item)}`
        );
      }
    }
  }

  // Validate confidence_breakdown (optional but recommended)
  let confidence: ConfidenceBreakdown;
  if (
    obj.confidence_breakdown &&
    typeof obj.confidence_breakdown === "object"
  ) {
    const cb = obj.confidence_breakdown as Record<string, unknown>;
    confidence = {
      overall: "low", // placeholder — caller should compute
      score: 0,       // placeholder — caller should compute
      dimensions: {
        image_quality: clampScore(cb.image_quality),
        drawing_clarity: clampScore(cb.drawing_clarity),
        trade_match: clampScore(cb.trade_match),
        symbol_recognition: clampScore(cb.symbol_recognition),
      },
      reasoning: typeof cb.reasoning === "string" ? cb.reasoning : "",
    };
  } else if (obj.confidence && typeof obj.confidence === "object") {
    // Support older format where confidence is the breakdown object directly
    const cb = obj.confidence as Record<string, unknown>;
    if (cb.dimensions && typeof cb.dimensions === "object") {
      const dims = cb.dimensions as Record<string, unknown>;
      confidence = {
        overall: (cb.overall as OverallConfidence) || "low",
        score: typeof cb.score === "number" ? cb.score : 0,
        dimensions: {
          image_quality: clampScore(dims.image_quality),
          drawing_clarity: clampScore(dims.drawing_clarity),
          trade_match: clampScore(dims.trade_match),
          symbol_recognition: clampScore(dims.symbol_recognition),
        },
        reasoning: typeof cb.reasoning === "string" ? cb.reasoning : "",
      };
    } else {
      confidence = makeEmptyConfidenceBreakdown();
    }
  } else {
    confidence = makeEmptyConfidenceBreakdown();
  }

  // Validate project_metadata
  let projectMetadata: ProjectMetadata = {};
  if (
    obj.project_metadata &&
    typeof obj.project_metadata === "object"
  ) {
    const pm = obj.project_metadata as Record<string, unknown>;
    projectMetadata = {
      project_type: typeof pm.project_type === "string" ? pm.project_type : undefined,
      address: typeof pm.address === "string" ? pm.address : undefined,
      drawing_set_ref: typeof pm.drawing_set_ref === "string" ? pm.drawing_set_ref : undefined,
      storey_count: typeof pm.storey_count === "number" ? pm.storey_count : undefined,
    };
  }

  // Build final result
  const result: DrawingAnalysisResult = {
    detected_items: items as DetectedItem[],
    notes: typeof obj.notes === "string" ? obj.notes : "",
    confidence,
    project_metadata: projectMetadata,
  };

  return result;
}

/**
 * Build the complete system prompt for a given trade and image quality.
 *
 * Combines:
 * 1. Trade-specific expertise instructions (detailed what-to-look-for guidance)
 * 2. Structured output schema (from {@link getTradeAnalysisSchema})
 * 3. Quality context (image score with contextual advice)
 * 4. Optional additional instructions from the caller
 *
 * @param trade - Target trade discipline (normalised internally).
 * @param imageQualityScore - Pre-computed image quality score (0–100).
 * @param instructions - Optional extra instructions to append (e.g. client notes,
 *                       special conditions, prior-quote context).
 * @returns A complete system prompt string ready for the Claude API.
 *
 * @example
 * const prompt = buildSystemPrompt("electrician", 82, "Client wants LED upgrades");
 * // → full multi-paragraph prompt with schema, expertise, and quality context
 */
export function buildSystemPrompt(
  trade: string,
  imageQualityScore: number,
  instructions?: string
): string {
  const canonical = normaliseTrade(trade);
  const expertise = TRADE_EXPERTISE_MAP[canonical] ?? DEFAULT_EXPERTISE;
  const schema = getTradeAnalysisSchema(trade);

  // Quality context
  let qualityContext: string;
  if (imageQualityScore >= 80) {
    qualityContext = `The uploaded image quality score is ${imageQualityScore}/100. The image is of excellent quality — you can confidently read fine details, small symbols, and dimension text.`;
  } else if (imageQualityScore >= 60) {
    qualityContext = `The uploaded image quality score is ${imageQualityScore}/100. The image is of good quality — most symbols and text should be readable. Flag any items where symbol clarity is reduced.`;
  } else if (imageQualityScore >= 40) {
    qualityContext = `The uploaded image quality score is ${imageQualityScore}/100. The image quality is moderate. Focus on clearly visible items and larger symbols. Be conservative — mark ambiguous detections as "medium" or "low" confidence and explain why.`;
  } else {
    qualityContext = `The uploaded image quality score is ${imageQualityScore}/100. The image quality is POOR. Focus ONLY on clearly visible, large items. Do NOT guess at obscured symbols or small text. Mark almost everything as "low" confidence with explanatory notes. Recommend the user uploads a higher-resolution scan.`;
  }

  const parts = [
    expertise.trim(),
    "",
    "---",
    "",
    schema,
    "",
    "---",
    "",
    qualityContext,
  ];

  if (instructions && instructions.trim()) {
    parts.push(
      "",
      "---",
      "",
      "## ADDITIONAL INSTRUCTIONS",
      "",
      instructions.trim()
    );
  }

  return parts.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS & PRIVATE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Custom error class for AI response parsing failures.
 * Carries a machine-readable `code` for upstream error handling.
 */
export class AnalysisParseError extends Error {
  readonly code = "ANALYSIS_PARSE_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "AnalysisParseError";
  }
}

/**
 * Clamp a raw score value to the 0–100 range.
 */
function clampScore(value: unknown): number {
  const num = typeof value === "number" ? value : 0;
  return Math.max(0, Math.min(100, Number.isFinite(num) ? num : 0));
}

/**
 * Create an empty confidence breakdown with default scores.
 */
function makeEmptyConfidenceBreakdown(): ConfidenceBreakdown {
  return {
    overall: "low",
    score: 0,
    dimensions: {
      image_quality: 0,
      drawing_clarity: 0,
      trade_match: 0,
      symbol_recognition: 0,
    },
    reasoning: "No confidence breakdown provided by AI.",
  };
}

/**
 * Truncate a string to `maxLen` characters, appending "…" if truncated.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

/**
 * Attempt to extract the outermost JSON object from a string using
 * brace-depth tracking.  More reliable than a simple regex for nested objects.
 *
 * @param text - Text that may contain a JSON object embedded in noise.
 * @returns The extracted JSON string, or `null` if no object found.
 */
function extractOutermostJsonObject(text: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (ch === "\\" && inString) {
      escapeNext = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") {
      if (depth === 0) {
        start = i;
      }
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TYPE GUARDS (optional runtime validation helpers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Narrow an unknown value to a valid {@link DetectedItem}.
 */
export function isDetectedItem(value: unknown): value is DetectedItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  const validUnit = ["each", "m", "m2", "m3", "hr", "lot", "point"].includes(
    String(v.unit)
  );
  const validConfidence = ["high", "medium", "low"].includes(
    String(v.confidence)
  );

  return (
    typeof v.label === "string" &&
    typeof v.item_key === "string" &&
    typeof v.quantity === "number" &&
    validUnit &&
    typeof v.labour_hours === "number" &&
    validConfidence
  );
}

/**
 * Narrow an unknown value to a valid {@link DrawingAnalysisResult}.
 */
export function isDrawingAnalysisResult(value: unknown): value is DrawingAnalysisResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  return (
    Array.isArray(v.detected_items) &&
    v.detected_items.every(isDetectedItem) &&
    typeof v.notes === "string" &&
    v.confidence !== null &&
    typeof v.confidence === "object" &&
    typeof v.project_metadata === "object"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Weight configuration for the confidence breakdown calculation. */
export const CONFIDENCE_WEIGHTS = {
  image_quality: 0.20,
  drawing_clarity: 0.25,
  trade_match: 0.20,
  symbol_recognition: 0.35,
} as const;

/** Score thresholds for overall confidence classification. */
export const CONFIDENCE_THRESHOLDS = {
  high: 75,
  medium: 50,
} as const;

/** All supported trade disciplines. */
export const SUPPORTED_TRADES: TradeDiscipline[] = [
  "electrician",
  "plumber",
  "carpenter",
  "tiler",
  "landscaper",
  "default",
];
