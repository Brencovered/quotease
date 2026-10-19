/**
 * POST /api/structures/from-plan
 * Reads an uploaded plan drawing (image, PDFs are rendered to an image in
 * the browser first) and returns a planner model built from its dimensions.
 *
 * Input:  { image: "data:image/jpeg;base64,...", notes?: string }
 * Output: { plan: NormalizedPlan & { rooms, footprint, confidence } }
 */
import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { MODELS } from "@/lib/ai/gateway";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";
import { PLAN_READ_PROMPT, PlanReadSchema, normalizePlanRead } from "@/lib/structureAi";

export const maxDuration = 60;

const MAX_DATA_URL = 4_000_000; // keep under Vercel's 4.5 MB body limit

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to Swiftscope to build from a plan.", signup: true }, { status: 401 });
  }

  const rl = await checkRateLimit(`structure-from-plan:${user.id}`, 10, 10 * 60 * 1000);
  const blocked = rateLimitResponseInit(rl);
  if (blocked) return NextResponse.json(blocked.body, blocked.init);

  let body: { image?: unknown; notes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That file was too big. Try a smaller image or one page." }, { status: 413 });
  }
  const image = typeof body.image === "string" ? body.image : "";
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image)) {
    return NextResponse.json({ error: "Upload a JPG, PNG or PDF of the plan." }, { status: 400 });
  }
  if (image.length > MAX_DATA_URL) {
    return NextResponse.json({ error: "That image is too big. Try a smaller photo or one page." }, { status: 413 });
  }
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";

  for (const model of [MODELS.VISION_PRIMARY, MODELS.VISION_FALLBACK]) {
    try {
      const result = await generateObject({
        model,
        schema: PlanReadSchema,
        maxRetries: 0,
        // AI SDK 7 rejects role "system" inside messages; the prompt goes in instructions.
        instructions: PLAN_READ_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", image },
              { type: "text", text: `Build the structure from this plan.${notes ? `\n\nNotes from the tradie: ${notes}` : ""}` },
            ],
          },
        ],
      });
      return NextResponse.json({ plan: normalizePlanRead(result.object), model });
    } catch (err) {
      console.error(`[structures/from-plan] ${model} failed:`, err);
    }
  }
  return NextResponse.json({ error: "Could not read that plan. Try a clearer image with the dimensions visible." }, { status: 502 });
}
