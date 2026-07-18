/**
 * @file route.ts
 * @description Next.js 15 API route for AI drawing analysis.
 *
 * Orchestrates the full drawing analysis pipeline:
 * 1. Authenticate user via Supabase
 * 2. Check usage limits (free tier + add-on)
 * 3. Parse uploaded file + metadata
 * 4. Run the analysis through `analyzeDrawing` orchestrator
 * 5. Return structured result with confidence scoring
 * 6. Update usage counters and log analysis (fire-and-forget)
 *
 * @route POST /api/quotes/analyze-drawing
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBusinessId } from "@/lib/team";
import { checkUsage, currentPeriod, type UsageProfile } from "@/lib/aiUsage";
import {
  analyzeDrawing,
  isSupportedMimeType,
  ValidationError,
  TradeGateError,
  AnalysisError,
  type AnalysisSuccess,
} from "@/lib/ai/drawingAnalysis";
import { normalizeTrade } from "@/lib/ai/tradeGates";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";

// ─────────────────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Profile fields required by the route handler.
 * We fetch more fields than the base Profile type to support usage tracking.
 */
interface ProfileWithUsage {
  id: string;
  trades: string[] | null;
  ai_free_analyses_used: number | null;
  ai_addon_status: string | null;
  ai_addon_period: string | null;
  ai_addon_analyses_used: number | null;
  ai_analyses_limit_override: number | null;
}

/** JSON-serialisable usage summary returned in the 200 response. */
interface UsageResponse {
  via: "free" | "addon";
  // checkUsage() (lib/aiUsage.ts) only ever populates ONE of these,
  // matching whichever quota bucket the request drew from - declaring
  // them as required `number` meant TypeScript should have caught every
  // "addon" response silently omitting remainingFree (and vice versa)
  // from the JSON entirely (JSON.stringify drops undefined keys), but
  // this project has `ignoreBuildErrors: true` so it shipped anyway.
  remainingFree?: number;
  remainingAddon?: number;
}

/** JSON-serialisable validation summary for the 200 response. */
interface ValidationResponse {
  score: string;
  issues: string[];
  estimatedTokens: number;
}

/** JSON-serialisable gate summary for the 200 response. */
interface GateResponse {
  queryScore: string;
  suggestions: string[];
  isRegistered: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ERROR RESPONSE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function errorResponse(
  status: number,
  body: Record<string, unknown>
): NextResponse {
  return NextResponse.json(body, { status });
}

// ─────────────────────────────────────────────────────────────────────────────
//  REQUEST HANDLER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST handler for the drawing analysis endpoint.
 *
 * Expects a `multipart/form-data` body with:
 * - `file` — the drawing image or PDF (required)
 * - `trade` — trade discipline string, defaults to `"electrician"`
 * - `instructions` — optional free-text instructions
 *
 * Returns a JSON object containing the full analysis result, model info,
 * usage breakdown, validation summary, and advisory gate info.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestStartTime = Date.now();

  try {
    // ── 1. Auth check ────────────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return errorResponse(401, { error: "Unauthorized — please sign in." });
    }

    const rl = await checkRateLimit(`analyze-drawing:${authUser.id}`, 10, 10 * 60 * 1000);
    if (!rl.allowed) {
      const blocked = rateLimitResponseInit(rl)!;
      return errorResponse(blocked.init.status, blocked.body);
    }

    // ── 2. Get active business ID ────────────────────────────────────────────
    let businessId: string;
    try {
      businessId = await getActiveBusinessId(supabase, authUser.id);
    } catch {
      return errorResponse(403, {
        error: "No active business profile found.",
      });
    }

    // ── 3. Fetch profile ─────────────────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, trades, ai_free_analyses_used, ai_addon_status, ai_addon_period, ai_addon_analyses_used, ai_analyses_limit_override"
      )
      .eq("id", businessId)
      .single<ProfileWithUsage>();

    if (profileError || !profile) {
      return errorResponse(404, { error: "Business profile not found." });
    }

    // ── 4. Usage check ───────────────────────────────────────────────────────
    const usage = checkUsage(profile as UsageProfile);
    if (!usage.allowed) {
      return errorResponse(402, {
        error: usage.reason,
        usageLimitReached: true,
      });
    }

    // ── 5. Parse the file -- either a direct multipart upload (small
    //      files, the common case, no extra round trip) or a JSON body
    //      pointing at a file the client already uploaded straight to
    //      Supabase Storage (large files -- Vercel serverless functions
    //      cap the request body at ~4.5MB, a real architectural PDF or a
    //      full-res phone photo routinely exceeds that, and there's no
    //      app-level config that raises this limit) ──────────────────────
    let fileBuffer: Buffer;
    let mimeType: string;
    let trade: string;
    let instructions: string | undefined;
    let fileSize: number;
    let tempStoragePath: string | null = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      let jsonBody: { storagePath?: string; trade?: string; instructions?: string; mimeType?: string };
      try {
        jsonBody = await request.json();
      } catch {
        return errorResponse(400, { error: "Invalid JSON body." });
      }

      const { storagePath } = jsonBody;
      if (!storagePath) {
        return errorResponse(400, { error: "Missing storagePath." });
      }

      const admin = createAdminClient();
      const { data: fileData, error: downloadError } = await admin.storage
        .from("drawing-analysis-temp")
        .download(storagePath);

      if (downloadError || !fileData) {
        return errorResponse(400, {
          error: "Could not retrieve the uploaded file. It may have expired -- please try uploading again.",
        });
      }

      trade = jsonBody.trade || "electrician";
      instructions = jsonBody.instructions || undefined;
      mimeType = jsonBody.mimeType || fileData.type || "application/octet-stream";
      fileBuffer = Buffer.from(await fileData.arrayBuffer());
      fileSize = fileBuffer.length;
      tempStoragePath = storagePath;
    } else {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return errorResponse(400, { error: "Invalid form data." });
      }

      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return errorResponse(400, { error: "Missing or invalid 'file' field." });
      }

      trade = (formData.get("trade") as string) || "electrician";
      instructions = (formData.get("instructions") as string) || undefined;
      mimeType = file.type;
      fileBuffer = Buffer.from(await file.arrayBuffer());
      fileSize = file.size;
    }

    // ── 6. Validate file type ────────────────────────────────────────────────
    if (!isSupportedMimeType(mimeType)) {
      return errorResponse(415, {
        error: `Unsupported file type: ${mimeType}. Supported: JPEG, PNG, WebP, PDF.`,
        canRetry: true,
      });
    }

    // ── 7. Run analysis pipeline ─────────────────────────────────────────────
    const analysis: AnalysisSuccess = await analyzeDrawing({
      fileBuffer,
      mimeType,
      trade,
      instructions,
      profileTrades: profile.trades ?? [],
      businessId,
      userId: authUser.id,
    });

    // Temp storage object has served its purpose -- clean it up regardless
    // of what happens next. Fire-and-forget, a leftover temp file is a
    // minor storage cost, not worth failing the response over.
    if (tempStoragePath) {
      createAdminClient().storage.from("drawing-analysis-temp").remove([tempStoragePath]).catch(() => {});
    }

    const totalTime = Date.now() - requestStartTime;

    // ── 9. Build response ───────────────────────────────────────────────────
    const usageResponse: UsageResponse = {
      via: usage.via,
      remainingFree: usage.remainingFree,
      remainingAddon: usage.remainingAddon,
    };

    const validationResponse: ValidationResponse = {
      score: analysis.validation.score,
      issues: analysis.validation.issues,
      estimatedTokens: analysis.validation.estimatedTokenCount,
    };

    const gateResponse: GateResponse = {
      queryScore: analysis.gate.queryScore,
      suggestions: analysis.gate.suggestions,
      isRegistered: analysis.gate.isRegistered,
    };

    // ── 10. Update usage counters (fire-and-forget) ──────────────────────────
    updateUsageCounters(supabase, profile, usage).catch((err) => {
      console.error("[analyze-drawing] Usage counter update failed:", err);
    });

    // ── 11. Log analysis to ai_drawing_analyses (fire-and-forget) ────────────
    logAnalysis(supabase, {
      profileId: businessId,
      trade: normalizeTrade(trade),
      fileType: mimeType,
      fileSize: fileSize,
      imageQualityScore: analysis.validation.score,
      queryScore: analysis.gate.queryScore,
      overallConfidence: analysis.result.confidence.overall,
      detectedItemsCount: analysis.result.detected_items.length,
      model: analysis.model,
      via: usage.via,
      processingTimeMs: totalTime,
    }).catch((err) => {
      console.error("[analyze-drawing] Analysis logging failed:", err);
    });

    // ── 12. Return success ───────────────────────────────────────────────────
    // analysis.result.confidence is now a weighted breakdown object
    // ({overall, score, dimensions, reasoning}) computed in
    // lib/ai/drawingAnalysis.ts. Every existing frontend call site
    // (QuoteBuilder, CarpenterQuoteBuilder, PlumberQuoteBuilder,
    // RooferQuoteBuilder, GenericQuoteBuilder, VoiceNoteRecorder) still
    // reads `result.confidence` expecting a plain "high"|"medium"|"low"
    // string - they even force-cast it (`as "high"|"medium"|"low"`) and
    // render it directly in a badge/banner. Replacing it with an object
    // would have shown "[object Object]" (or worse) in every one of
    // those, with nothing in the type system catching it since this
    // project has `ignoreBuildErrors: true`. Keep the field frontend
    // code already depends on as the plain overall string, and expose
    // the full weighted breakdown under a new field for future UI work.
    const { confidence: confidenceBreakdown, ...resultRest } = analysis.result;
    const resultForResponse = {
      ...resultRest,
      confidence: confidenceBreakdown.overall,
      confidenceDetail: confidenceBreakdown,
    };

    return NextResponse.json(
      {
        result: resultForResponse,
        model: analysis.model,
        usage: usageResponse,
        validation: validationResponse,
        gate: gateResponse,
      },
      { status: 200 }
    );
  } catch (err) {
    return handlePipelineError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SIDE-EFFECT HELPERS (fire-and-forget)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update the usage counters on the user's profile.
 *
 * - **Free tier** — increments `ai_free_analyses_used`.
 * - **Add-on** — sets `ai_addon_period` to the current billing period string
 *   and increments `ai_addon_analyses_used`.
 *
 * Errors are logged but never thrown (fire-and-forget).
 */
async function updateUsageCounters(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: ProfileWithUsage,
  usage: { via: "free" | "addon" }
): Promise<void> {
  if (usage.via === "free") {
    const current = profile.ai_free_analyses_used ?? 0;
    await supabase
      .from("profiles")
      .update({ ai_free_analyses_used: current + 1 })
      .eq("id", profile.id);
  } else if (usage.via === "addon") {
    const period = currentPeriod();
    const currentAddonUsed = profile.ai_addon_analyses_used ?? 0;
    await supabase
      .from("profiles")
      .update({
        ai_addon_period: period,
        ai_addon_analyses_used: currentAddonUsed + 1,
      })
      .eq("id", profile.id);
  }
}

/**
 * Persist a record of the analysis to `ai_drawing_analyses`.
 *
 * This table drives analytics, trade insights, and query-quality tracking.
 * Errors are logged but never thrown (fire-and-forget).
 */
async function logAnalysis(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    profileId: string;
    trade: string;
    fileType: string;
    fileSize: number;
    imageQualityScore: string;
    queryScore: string;
    overallConfidence: string;
    detectedItemsCount: number;
    model: string;
    via: string;
    processingTimeMs: number;
  }
): Promise<void> {
  await supabase.from("ai_drawing_analyses").insert({
    profile_id: params.profileId,
    trade: params.trade,
    file_type: params.fileType,
    file_size: params.fileSize,
    image_quality_score: params.imageQualityScore,
    query_score: params.queryScore,
    overall_confidence: params.overallConfidence,
    detected_items_count: params.detectedItemsCount,
    model: params.model,
    via: params.via,
    processing_time_ms: params.processingTimeMs,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route-level error handler that maps pipeline errors to appropriate HTTP
 * status codes and JSON response shapes.
 *
 * | Error type        | Status | Body shape                                  |
 * |-------------------|--------|---------------------------------------------|
 * | ValidationError   | 422    | `{ error, validation, canRetry }`           |
 * | TradeGateError    | 422    | `{ error, gate, canRetry }`                 |
 * | AnalysisError     | 502    | `{ error, code }`                           |
 * | (generic)         | 500    | `{ error }`                                 |
 */
function handlePipelineError(err: unknown): NextResponse {
  // ── ValidationError ────────────────────────────────────────────────────────
  if (err instanceof ValidationError) {
    return errorResponse(422, {
      error: err.message,
      validation: {
        score: err.result.score,
        issues: err.result.issues,
        estimatedTokens: err.result.estimatedTokenCount,
        guidance: err.result.guidance,
      },
      canRetry: true,
    });
  }

  // ── TradeGateError ─────────────────────────────────────────────────────────
  if (err instanceof TradeGateError) {
    return errorResponse(422, {
      error: err.message,
      gate: {
        queryScore: err.gate.queryScore,
        suggestions: err.gate.suggestions,
        isRegistered: err.gate.isRegistered,
        matchedTrade: err.gate.matchedTrade,
      },
      canRetry: true,
    });
  }

  // ── AnalysisError ──────────────────────────────────────────────────────────
  if (err instanceof AnalysisError) {
    console.error("[analyze-drawing] AnalysisError:", err.code, err.message);
    return errorResponse(502, {
      error: err.message,
      code: err.code,
      canRetry: err.code === "RESPONSE_TRUNCATED",
    });
  }

  // ── Generic / unexpected ───────────────────────────────────────────────────
  const message =
    err instanceof Error ? err.message : "An unexpected error occurred.";
  console.error("[analyze-drawing] Unhandled error:", err);
  return errorResponse(500, { error: message });
}
