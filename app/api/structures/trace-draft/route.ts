/**
 * POST /api/structures/trace-draft
 * Trace mode: a first-pass trace of a floor plan image (outline, internal
 * walls, rooms with labelled sizes, openings) in 0-1000 image coordinates.
 * The tradie checks and drags it onto the drawing; the planner works out
 * the scale from the labelled room sizes.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { MODELS } from "@/lib/ai/gateway";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";
import { TRACE_DRAFT_PROMPT, TraceDraftSchema, normalizeTraceDraft } from "@/lib/structureAi";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to Swiftscope to use AI draft.", signup: true }, { status: 401 });

  const rl = await checkRateLimit(`structure-trace-draft:${user.id}`, 10, 10 * 60 * 1000);
  const blocked = rateLimitResponseInit(rl);
  if (blocked) return NextResponse.json(blocked.body, blocked.init);

  let body: { image?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That plan image is too big. Try one page or a smaller image." }, { status: 413 });
  }
  const image = typeof body.image === "string" ? body.image : "";
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 4_000_000) {
    return NextResponse.json({ error: "Upload a JPG, PNG or PDF of the plan first." }, { status: 400 });
  }

  for (const model of [MODELS.VISION_PRIMARY, MODELS.VISION_FALLBACK]) {
    try {
      const result = await generateObject({
        model,
        schema: TraceDraftSchema,
        maxRetries: 0,
        // AI SDK 7: system prompt goes in instructions, never in messages.
        instructions: TRACE_DRAFT_PROMPT,
        messages: [{ role: "user", content: [{ type: "image", image }, { type: "text", text: "Trace this floor plan." }] }],
      });
      return NextResponse.json({ draft: normalizeTraceDraft(result.object), model });
    } catch (err) {
      console.error(`[structures/trace-draft] ${model} failed:`, err);
    }
  }
  return NextResponse.json({ error: "AI draft could not read this plan. Trace it by hand, it only takes a few minutes." }, { status: 502 });
}
