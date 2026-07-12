/**
 * POST /api/ai/voice-quote
 * ------------------------
 * Converts a tradie's voice dictation or rough text notes into structured
 * quote line items ready to insert into the Swiftscope quote builder.
 *
 * Input:  { transcript: string, trade: string, userId: string }
 * Output: { lineItems: LineItem[], raw: string, model: string }
 *
 * Example input:
 *   "install 4 downlights in the kitchen, replace the switchboard,
 *    run new circuit to the garage, supply and install 2 exhaust fans"
 *
 * Example output:
 *   [
 *     { description: "Supply & install downlights", quantity: 4, unit: "each", notes: "kitchen" },
 *     { description: "Switchboard replacement", quantity: 1, unit: "each", notes: "" },
 *     { description: "New circuit to garage", quantity: 1, unit: "each", notes: "" },
 *     { description: "Supply & install exhaust fan", quantity: 2, unit: "each", notes: "" },
 *   ]
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateObjectWithFallback, MODELS } from "@/lib/ai/gateway";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";

// ── Schema ────────────────────────────────────────────────────────────────────

const LineItemSchema = z.object({
  description: z.string().describe("Clean professional description of the work item"),
  quantity:    z.number().describe("Quantity as a number"),
  unit:        z.enum(["each","m","m2","m3","hr","day","lot","point"]).describe("Unit of measure"),
  unit_cost:   z.number().nullable().describe("Estimated unit cost in AUD if inferable, else null"),
  notes:       z.string().describe("Location, specification or clarification notes"),
});

const QuoteSchema = z.object({
  line_items: z.array(LineItemSchema).describe("Array of quote line items extracted from the transcript"),
  summary:    z.string().describe("One-sentence summary of the overall scope of work"),
  warnings:   z.array(z.string()).describe("Any ambiguities or missing info the tradie should clarify"),
});

type QuoteOutput = z.infer<typeof QuoteSchema>;

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(trade: string) {
  return `You are an expert Australian ${trade} quoting assistant.

Your job is to convert rough voice notes or text from a tradie into clean, structured quote line items.

Rules:
- Extract every distinct work item as a separate line item
- Use professional Australian trade terminology
- Quantities must be numbers (not strings)
- If a quantity is not specified, default to 1
- Unit costs are optional -- only include if clearly stated or strongly implied by standard rates
- Notes should capture location, spec, or any clarification needed
- Warnings should flag anything ambiguous or missing that affects the quote
- Do not invent items that weren't mentioned
- Australian spelling (e.g. "metre" not "meter")`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(`voice-quote:${user.id}`, 15, 10 * 60 * 1000);
  const rlBlocked = rateLimitResponseInit(rl);
  if (rlBlocked) return NextResponse.json(rlBlocked.body, rlBlocked.init);

  const body = await req.json();
  const { transcript, trade = "electrician" } = body as {
    transcript: string;
    trade:      string;
  };

  if (!transcript?.trim()) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  if (transcript.length > 4000) {
    return NextResponse.json({ error: "Transcript too long (max 4000 chars)" }, { status: 400 });
  }

  try {
    const result = await generateObjectWithFallback<QuoteOutput>({
      primaryModel:  MODELS.TEXT_PRIMARY,
      fallbackModel: MODELS.TEXT_FALLBACK,
      system:        buildSystemPrompt(trade),
      prompt:        `Convert this into quote line items:\n\n${transcript}`,
      schema:        QuoteSchema,
    });

    return NextResponse.json({
      line_items: result.object.line_items,
      summary:    result.object.summary,
      warnings:   result.object.warnings,
      model:      result.model,
      usage:      result.usage,
    });

  } catch (err) {
    console.error("[voice-quote] Error:", err);
    return NextResponse.json(
      { error: "AI processing failed. Please try again." },
      { status: 500 }
    );
  }
}
