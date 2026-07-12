/**
 * tradeGates.ts - Trade Access Gating & Query Optimisation Module
 *
 * Determines whether a tradie's AI drawing-analysis request is well-targeted
 * for their registered trade(s), scores the quality of their instructions,
 * and returns trade-specific guidance for better results.
 *
 * The gate is **advisory only** - `allowed` is always `true`.  It surfaces
 * warnings and actionable suggestions without ever blocking the user.
 */

// --- Types ------------------------------------------------------------------

/** Quality rating for the instructions a user has provided alongside their upload. */
export type QueryScore = "optimized" | "good" | "needs_work" | "minimal";

/**
 * Outcome of running the trade gate check.
 *
 * `allowed` is always `true` - this is an advisory gate, not a hard block.
 */
export interface TradeGateResult {
  /** Always `true` - the gate never blocks analysis. */
  allowed: boolean;
  /** Canonical (normalised) trade name derived from the user's request. */
  matchedTrade: string;
  /** `true` when `matchedTrade` is present in the user's profile trades. */
  isRegistered: boolean;
  /** Human-readable trade-specific advice for uploads and queries. */
  guidance: string;
  /** Quality score for the instructions the user provided. */
  queryScore: QueryScore;
  /** Actionable improvements the user can make before (or during) analysis. */
  suggestions: string[];
}

/** Comprehensive guidance tailored to a specific trade. */
export interface TradeGuidance {
  /** Canonical trade key (e.g. `'electrician'`). */
  trade: string;
  /** Human-friendly display name (e.g. `"Electrical"`). */
  displayName: string;
  /** Tips for uploading the best-quality documents. */
  uploadTips: string[];
  /** Example prompts the user can copy/paste or adapt. */
  instructionPrompts: string[];
  /** Preferred file formats for AI parsing. */
  optimalFileTypes: string[];
  /** Maximum number of plan pages recommended for a single analysis job. */
  maxRecommendedPages: number;
  /** Symbols or annotation strings the AI should look for on the drawings. */
  keySymbols: string[];
}

// --- Constants --------------------------------------------------------------

/** Maps common aliases to canonical trade names. */
const TRADE_ALIASES: Record<string, string> = {
  electrical: "electrician",
  electrician: "electrician",
  sparky: "electrician",
  plumbing: "plumber",
  plumber: "plumber",
  hydraulics: "plumber",
  carpenter: "carpenter",
  builder: "carpenter",
  framer: "carpenter",
  carpentry: "carpenter",
  building: "carpenter",
  tiler: "tiler",
  tiling: "tiler",
  waterproofer: "tiler",
  waterproofing: "tiler",
  landscaper: "landscaper",
  landscaping: "landscaper",
  landscape: "landscaper",
};

const SUPPORTED_TRADES: string[] = [
  "electrician",
  "plumber",
  "carpenter",
  "tiler",
  "landscaper",
];

const TRADE_GUIDANCE_MAP: Record<string, TradeGuidance> = {
  electrician: {
    trade: "electrician",
    displayName: "Electrical",
    uploadTips: [
      "Upload the floor plan + lighting plan + legend sheet",
      "Ensure the symbol legend is clearly visible - the AI uses it to identify items",
      "Circle or mark areas of concern with a red pen before scanning",
      "Avoid shadows and glare - scan flat plans under even lighting",
    ],
    instructionPrompts: [
      "2 storey renovation, need GPO and downlight counts for both floors",
      "New build - count all power points, data points, and light fittings per room",
      "Check switchboard capacity for 3-phase upgrade - list all circuits",
    ],
    optimalFileTypes: ["PDF", "PNG"],
    maxRecommendedPages: 5,
    keySymbols: ["GPO", "downlight DL1", "switch", "data point", "smoke alarm", "cable run"],
  },
  plumber: {
    trade: "plumber",
    displayName: "Plumbing",
    uploadTips: [
      "Upload hydraulic plan + fixture schedule",
      "Include the legend showing fixture codes (WC-1, KS, SH, etc.)",
      "Mark any TBC or provisional items",
      "Ensure pipe sizing annotations are legible",
    ],
    instructionPrompts: [
      "Bathroom reno - count all fixtures and confirm floor wastes",
      "New house rough-in - fixture count and hot water unit location",
      "Check stormwater discharge point and OSD requirements",
    ],
    optimalFileTypes: ["PDF", "PNG"],
    maxRecommendedPages: 5,
    keySymbols: ["WC", "basin", "shower", "HWU", "floor waste", "pipe run"],
  },
  carpenter: {
    trade: "carpenter",
    displayName: "Carpentry",
    uploadTips: [
      "Upload architectural plans + structural drawings",
      "Include door/window schedule",
      "Highlight any load-bearing walls",
      "Include section drawings for ceiling heights",
    ],
    instructionPrompts: [
      "Extension - frame count for walls and roof with stud sizes",
      "Decking job - lineal metres, bearer sizes, and post count",
      "Door and window count for supply order with schedule references",
    ],
    optimalFileTypes: ["PDF", "PNG"],
    maxRecommendedPages: 8,
    keySymbols: ["wall frame", "door", "window", "beam", "lintel", "decking"],
  },
  tiler: {
    trade: "tiler",
    displayName: "Tiling",
    uploadTips: [
      "Upload wet area details + tile schedule",
      "Include finishes schedule with tile codes (T1, T2, FT1)",
      "Note any waterproofing class requirements",
      "Include floor plan with room dimensions",
    ],
    instructionPrompts: [
      "Bathroom - tile areas per surface and waterproofing extents",
      "Full house - floor and wall tiling per room with tile codes",
      "Check screed falls and substrate preparation requirements",
    ],
    optimalFileTypes: ["PDF", "PNG"],
    maxRecommendedPages: 5,
    keySymbols: ["tile T1", "waterproofing", "floor waste", "niche", "trim"],
  },
  landscaper: {
    trade: "landscaper",
    displayName: "Landscaping",
    uploadTips: [
      "Upload landscape plan + site plan with levels",
      "Include planting schedule if available",
      "Note retaining wall heights and materials",
      "Include drainage and irrigation plans",
    ],
    instructionPrompts: [
      "Backyard reno - paving area, turf sqm, and retaining wall lineal metres",
      "Full landscape - plant count by species and irrigation zones",
      "Check levels and cut/fill volumes from site plan",
    ],
    optimalFileTypes: ["PDF", "PNG"],
    maxRecommendedPages: 6,
    keySymbols: ["paving", "turf", "retaining wall", "drainage", "plant", "irrigation"],
  },
};

const SCORE_SUGGESTIONS: Record<QueryScore, (guidance: TradeGuidance) => string[]> = {
  minimal: () => [
    "Add instructions describing what you need counted",
    "Mention the project type (reno, new build, extension)",
    "Specify which sheets are included (floor plan, electrical plan, legend)",
  ],
  needs_work: (guidance) => [
    "Be more specific about what to count",
    "Include project scope details",
    guidance.instructionPrompts[0] ?? "Try an example prompt from the guidance below",
  ],
  good: (guidance) => [
    guidance.uploadTips[0] ?? "Upload clear, high-resolution scans",
    "Consider adding room-by-room breakdown requests",
  ],
  optimized: () => ["Query looks good - analysis starting now"],
};

// --- Helpers ----------------------------------------------------------------

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function countTradeKeywordMatches(instructions: string, trade: string): number {
  const lower = instructions.toLowerCase();
  const guidance = TRADE_GUIDANCE_MAP[trade];
  if (!guidance) return 0;
  const keywords = [
    ...guidance.keySymbols.map((s) => s.toLowerCase()),
    guidance.displayName.toLowerCase(),
    trade.toLowerCase(),
  ];
  return keywords.filter((kw) => lower.includes(kw)).length;
}

// --- Public API -------------------------------------------------------------

/**
 * Normalises a free-form trade string to its canonical name.
 *
 * Supports fuzzy matching via common aliases used on Australian job sites:
 * `'sparky'` -> `'electrician'`, `'builder'` -> `'carpenter'`, etc.
 */
export function normalizeTrade(trade: string): string {
  if (!trade || typeof trade !== "string") return "";
  const cleaned = trade.trim().toLowerCase();
  if (!cleaned) return "";
  return TRADE_ALIASES[cleaned] ?? cleaned;
}

/**
 * Checks whether the requested trade matches the tradie's registered profile
 * trades, scores their instruction quality, and returns tailored guidance.
 *
 * This gate is **advisory only** - `allowed` is always `true`.
 */
export function checkTradeGate(
  profileTrades: string[],
  requestedTrade: string,
  instructions?: string
): TradeGateResult {
  const matchedTrade = normalizeTrade(requestedTrade);
  const safeProfileTrades = Array.isArray(profileTrades) ? profileTrades : [];
  const normalisedProfile = safeProfileTrades.map(normalizeTrade);
  const isRegistered = matchedTrade ? normalisedProfile.includes(matchedTrade) : false;

  // Score the query
  let queryScore: QueryScore = "minimal";
  const instructionText = (instructions ?? "").trim();

  if (instructionText.length === 0) {
    queryScore = "minimal";
  } else if (instructionText.length > 50 && matchedTrade) {
    const tradeMatches = countTradeKeywordMatches(instructionText, matchedTrade);
    queryScore = tradeMatches >= 2 ? "optimized" : "good";
  } else if (instructionText.length > 20) {
    queryScore = "good";
  } else {
    queryScore = "needs_work";
  }

  // Build guidance
  const guidance = getTradeGuidance(matchedTrade);
  const suggestionBuilder = SCORE_SUGGESTIONS[queryScore];
  const suggestions = suggestionBuilder ? suggestionBuilder(guidance) : [];

  const advisoryParts: string[] = [];
  if (!isRegistered && matchedTrade) {
    const registeredList = safeProfileTrades.length ? safeProfileTrades.join(", ") : "none";
    advisoryParts.push(
      `Heads up - you selected "${guidance.displayName}" but your registered trades are: ${registeredList}. You can still proceed, but double-check you're analysing the right trade.`
    );
  }
  advisoryParts.push(`Tips for ${guidance.displayName}: ${guidance.uploadTips[0]}`);
  if (guidance.instructionPrompts.length > 0) {
    advisoryParts.push(`Try an instruction like: "${guidance.instructionPrompts[0]}"`);
  }

  return {
    allowed: true,
    matchedTrade,
    isRegistered,
    guidance: advisoryParts.join(" "),
    queryScore,
    suggestions,
  };
}

/**
 * Retrieves detailed guidance for a given canonical trade.
 *
 * Falls back to sensible defaults for unsupported or unknown trades.
 */
export function getTradeGuidance(trade: string): TradeGuidance {
  const canonical = normalizeTrade(trade);
  if (TRADE_GUIDANCE_MAP[canonical]) {
    return TRADE_GUIDANCE_MAP[canonical];
  }
  const displayName = capitalize(canonical || trade || "General");
  return {
    trade: canonical || trade || "general",
    displayName,
    uploadTips: [
      "Upload the plan sheets most relevant to your trade",
      "Include the legend/symbol key",
      "Mark areas you need priced with a highlighter",
    ],
    instructionPrompts: [
      "Count all items matching my trade from these plans",
      "Extract quantities for materials ordering",
      "Flag any TBC or unpriced items",
    ],
    optimalFileTypes: ["PDF", "PNG", "JPEG"],
    maxRecommendedPages: 5,
    keySymbols: ["legend symbols", "annotations", "dimensions"],
  };
}

/**
 * Returns guidance objects for every supported trade.
 */
export function getAllTradeGuidance(): TradeGuidance[] {
  return SUPPORTED_TRADES.map((trade) => TRADE_GUIDANCE_MAP[trade]);
}
