/**
 * @file drawingAnalysis.ts
 * @description Orchestrator module for the AI drawing analysis pipeline.
 *
 * Composes three specialised sub-modules into a single cohesive flow:
 * 1. **Image validation** (`drawingValidation`) — checks file quality before AI processing
 * 2. **Trade gate** (`tradeGates`) — advisory trade matching + query optimisation
 * 3. **Schema + parsing** (`analysisSchema`) — structured output schemas & confidence scoring
 *
 * The orchestrator handles the full lifecycle: validation → gating → prompt building →
 * Claude API call → response parsing → confidence scoring → result assembly.
 *
 * @module lib/ai/drawingAnalysis
 */

import { validateDrawing, type ValidationResult } from "./drawingValidation";
import { checkTradeGate, normalizeTrade, type TradeGateResult } from "./tradeGates";
import {
  buildSystemPrompt,
  parseAnalysisResponse,
  calculateOverallConfidence,
  type DrawingAnalysisResult,
  type ConfidenceBreakdown,
} from "./analysisSchema";

// ─────────────────────────────────────────────────────────────────────────────
//  ERROR CLASSES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when the uploaded image fails quality validation.
 *
 * The attached {@link ValidationResult} contains human-readable guidance
 * and a list of specific issues so the UI can show actionable feedback.
 */
export class ValidationError extends Error {
  public readonly result: ValidationResult;

  constructor(result: ValidationResult) {
    super(result.guidance);
    this.name = "ValidationError";
    this.result = result;
  }
}

/**
 * Thrown when the trade gate detects a critical mismatch.
 *
 * The gate is normally **advisory only**, but this error is reserved for
 * edge cases where proceeding would be meaningless (e.g. completely
 * unrecognised trade with no registered trades on the profile).
 */
export class TradeGateError extends Error {
  public readonly gate: TradeGateResult;

  constructor(gate: TradeGateResult) {
    super(gate.guidance);
    this.name = "TradeGateError";
    this.gate = gate;
  }
}

/**
 * Thrown when the AI analysis itself fails — e.g. API error, unparseable
 * response, or empty result.
 *
 * The `code` field is machine-readable and safe to switch on in the UI.
 */
export class AnalysisError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "AnalysisError";
    this.code = code;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Parameters required to run a full drawing analysis. */
export interface AnalysisParams {
  /** Raw file bytes from the uploaded File. */
  fileBuffer: Buffer;
  /** MIME type reported by the browser (e.g. `image/jpeg`). */
  mimeType: string;
  /** Trade discipline selected by the user (e.g. `"electrician"`). */
  trade: string;
  /** Optional free-text instructions from the user. */
  instructions?: string;
  /** Trades registered on the user's profile (used for gate checking). */
  profileTrades: string[];
  /** Active business / profile ID (for logging). */
  businessId: string;
  /** Authenticated user ID (for logging). */
  userId: string;
  /** Anthropic API key (pulled from env by the route handler). */
  anthropicApiKey: string;
}

/** Successful analysis result with full metadata. */
export interface AnalysisSuccess {
  /** Parsed and validated drawing analysis. */
  result: DrawingAnalysisResult;
  /** Anthropic model that produced the response. */
  model: string;
  /** Raw text response (useful for debugging). */
  rawResponse?: string;
  /** Per-step timing breakdown in milliseconds. */
  timing: {
    validationMs: number;
    gateCheckMs: number;
    aiCallMs: number;
    parsingMs: number;
  };
  /** Advisory trade-gate result (always present, never blocking). */
  gate: TradeGateResult;
  /** Image validation result that passed. */
  validation: ValidationResult;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Primary vision model — used for both images and PDFs. */
const PRIMARY_MODEL = "claude-sonnet-4-6";

/** Fallback model used when the primary model returns a 5xx or rate-limit error. */
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";

/** Anthropic Messages API endpoint. */
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/** Maximum tokens for the analysis response. */
const MAX_TOKENS = 2000;

/** Anthropic API version header. */
const ANTHROPIC_VERSION = "2023-06-01";

/** Supported MIME types for upload. */
const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert an {@link ImageQualityScore} string into a numeric 0–100 score
 * suitable for `buildSystemPrompt`.
 *
 * | Score string | Numeric value |
 * |-------------|---------------|
 * | high        | 85            |
 * | medium      | 65            |
 * | low         | 45            |
 * | rejected    | 20            |
 */
function qualityScoreToNumeric(score: ValidationResult["score"]): number {
  switch (score) {
    case "high":
      return 85;
    case "medium":
      return 65;
    case "low":
      return 45;
    case "rejected":
      return 20;
    default:
      return 50;
  }
}

/**
 * Build the user message content array for the Anthropic Messages API.
 *
 * Images are sent as `type: "image"` with base64 source.
 * PDFs are sent as `type: "document"` with base64 source.
 */
function buildUserContent(
  base64Data: string,
  mimeType: string
): Array<{
  type: string;
  source?: { type: string; media_type: string; data: string };
}> {
  if (mimeType === "application/pdf") {
    return [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64Data,
        },
      },
    ];
  }

  // Image types
  return [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType,
        data: base64Data,
      },
    },
  ];
}

/**
 * Call the Anthropic Messages API with automatic fallback to a cheaper model
 * on server errors or rate limits.
 *
 * @param apiKey   — Anthropic API key.
 * @param model    — Primary model name.
 * @param system   — System prompt text.
 * @param content  — User message content array (image/document).
 * @returns Raw text content from the assistant message.
 * @throws AnalysisError on permanent failure.
 */
async function callClaude(
  apiKey: string,
  model: string,
  system: string,
  content: Array<{ type: string; source?: { type: string; media_type: string; data: string } }>
): Promise<{ text: string; modelUsed: string }> {
  const body = {
    model,
    max_tokens: MAX_TOKENS,
    system,
    messages: [
      {
        role: "user" as const,
        content,
      },
    ],
  };

  // ── Attempt 1: primary model ─────────────────────────────────────────────
  let response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  // ── Fallback: 5xx or rate-limit (429) ────────────────────────────────────
  if (!response.ok && (response.status >= 500 || response.status === 429)) {
    body.model = FALLBACK_MODEL;
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });
  }

  // ── Handle errors ────────────────────────────────────────────────────────
  if (!response.ok) {
    let errorDetail = "";
    try {
      const errorJson = (await response.json()) as Record<string, unknown>;
      errorDetail = JSON.stringify(errorJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new AnalysisError(
      `Anthropic API error (${response.status}): ${errorDetail}`,
      `ANTHROPIC_API_${response.status}`
    );
  }

  // ── Parse success ────────────────────────────────────────────────────────
  const data = (await response.json()) as Record<string, unknown>;

  // Extract text from content blocks
  const contentBlocks = data.content;
  if (Array.isArray(contentBlocks)) {
    const textBlocks = contentBlocks
      .filter(
        (block: unknown): block is { type: string; text?: string } =>
          typeof block === "object" &&
          block !== null &&
          (block as Record<string, unknown>).type === "text"
      )
      .map((block) => block.text ?? "")
      .filter(Boolean);

    if (textBlocks.length > 0) {
      return { text: textBlocks.join("\n"), modelUsed: body.model };
    }
  }

  // Some responses have text directly on data.text
  if (typeof data.text === "string" && data.text.length > 0) {
    return { text: data.text, modelUsed: body.model };
  }

  throw new AnalysisError(
    "Empty or unrecognised response structure from Anthropic API.",
    "EMPTY_RESPONSE"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full drawing analysis pipeline.
 *
 * Pipeline stages (in order):
 * 1. **Validate image** — check quality, dimensions, file size. Throw
 *    {@link ValidationError} on failure.
 * 2. **Trade gate** — advisory check for trade registration & instruction
 *    quality. Never blocks, but the result is returned for UI feedback.
 * 3. **Build system prompt** — combine trade expertise, JSON schema, image
 *    quality context, and user instructions.
 * 4. **Call Claude** — send image/PDF to Anthropic Messages API with
 *    automatic fallback on server errors.
 * 5. **Parse response** — strip markdown, validate JSON, check required fields.
 * 6. **Compute confidence** — run weighted scoring over the dimension
 *    breakdown and merge back into the result.
 *
 * @param params — {@link AnalysisParams} containing file, trade, auth, etc.
 * @returns {@link AnalysisSuccess} with parsed result, model name, timing, and
 *          advisory gate/validation metadata.
 *
 * @throws {@link ValidationError} when the image fails quality checks.
 * @throws {@link TradeGateError} on critical (non-advisory) gate failures.
 * @throws {@link AnalysisError} when the AI call or parsing fails.
 *
 * @example
 * ```ts
 * const analysis = await analyzeDrawing({
 *   fileBuffer: buf,
 *   mimeType: "image/png",
 *   trade: "electrician",
 *   instructions: "Count GPOs and downlights for both floors",
 *   profileTrades: ["electrician", "plumber"],
 *   businessId: "profile-uuid",
 *   userId: "auth-uuid",
 *   anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
 * });
 * console.log(analysis.result.detected_items);
 * ```
 */
export async function analyzeDrawing(params: AnalysisParams): Promise<AnalysisSuccess> {
  const { fileBuffer, mimeType, trade, instructions, profileTrades, anthropicApiKey } =
    params;

  const timing: AnalysisSuccess["timing"] = {
    validationMs: 0,
    gateCheckMs: 0,
    aiCallMs: 0,
    parsingMs: 0,
  };

  // ── 1. Validate image ────────────────────────────────────────────────────
  const t0 = Date.now();
  const validationResult = await validateDrawing(fileBuffer, mimeType);
  timing.validationMs = Date.now() - t0;

  if (!validationResult.valid) {
    throw new ValidationError(validationResult);
  }

  // ── 2. Trade gate (advisory) ─────────────────────────────────────────────
  const t1 = Date.now();
  const normalizedTrade = normalizeTrade(trade);
  const gateResult = checkTradeGate(profileTrades, normalizedTrade, instructions);
  timing.gateCheckMs = Date.now() - t1;

  // ── 3. Build system prompt ───────────────────────────────────────────────
  const validationScore = qualityScoreToNumeric(validationResult.score);
  const systemPrompt = buildSystemPrompt(normalizedTrade, validationScore, instructions);

  // ── 4. Call Claude ───────────────────────────────────────────────────────
  const t2 = Date.now();
  const base64Data = fileBuffer.toString("base64");
  const userContent = buildUserContent(base64Data, mimeType);

  const { text: rawText, modelUsed } = await callClaude(
    anthropicApiKey,
    PRIMARY_MODEL,
    systemPrompt,
    userContent
  );
  timing.aiCallMs = Date.now() - t2;

  // ── 5. Parse response ────────────────────────────────────────────────────
  const t3 = Date.now();
  const parsedResult = parseAnalysisResponse(rawText);
  timing.parsingMs = Date.now() - t3;

  // ── 6. Compute confidence ────────────────────────────────────────────────
  const dimensions = parsedResult.confidence.dimensions;
  const confidence = calculateOverallConfidence(dimensions);

  // Merge computed confidence back into the result
  parsedResult.confidence.overall = confidence.overall;
  parsedResult.confidence.score = confidence.score;

  return {
    result: parsedResult,
    model: modelUsed,
    rawResponse: rawText,
    timing,
    gate: gateResult,
    validation: validationResult,
  };
}

/**
 * Synchronous check for whether a MIME type is supported by the pipeline.
 *
 * Use this in the UI to filter the file-picker or show a pre-upload
 * compatibility message.
 *
 * @param mimeType — MIME type string (e.g. `"image/png"`).
 * @returns `true` if the type can be analysed.
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType);
}
