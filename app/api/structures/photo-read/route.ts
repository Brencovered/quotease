/**
 * POST /api/structures/photo-read
 * Trace mode: reads photos of the house for what a floor plan does not show
 * (roof shape and cover, cladding, eaves, storeys, condition) so the
 * planner's construction settings start from the real building.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { MODELS } from "@/lib/ai/gateway";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";
import { PHOTO_READ_PROMPT, PhotoReadSchema, normalizePhotoRead } from "@/lib/structureAi";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to Swiftscope to read photos.", signup: true }, { status: 401 });

  const rl = await checkRateLimit(`structure-photo-read:${user.id}`, 10, 10 * 60 * 1000);
  const blocked = rateLimitResponseInit(rl);
  if (blocked) return NextResponse.json(blocked.body, blocked.init);

  let body: { images?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Those photos are too big. Try fewer at a time." }, { status: 413 });
  }
  const images = (Array.isArray(body.images) ? body.images : [])
    .filter((i): i is string => typeof i === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(i))
    .slice(0, 4);
  const total = images.reduce((a, i) => a + i.length, 0);
  if (!images.length) return NextResponse.json({ error: "Add a photo of the house first." }, { status: 400 });
  if (total > 4_200_000) return NextResponse.json({ error: "Those photos are too big. Try fewer at a time." }, { status: 413 });

  const content = [
    ...images.map((image) => ({ type: "image" as const, image })),
    { type: "text" as const, text: `These ${images.length === 1 ? "is a photo" : `are ${images.length} photos`} of the same house. Describe it.` },
  ];
  for (const model of [MODELS.VISION_PRIMARY, MODELS.VISION_FALLBACK]) {
    try {
      const result = await generateObject({
        model,
        schema: PhotoReadSchema,
        maxRetries: 0,
        // AI SDK 7: system prompt goes in instructions, never in messages.
        instructions: PHOTO_READ_PROMPT,
        messages: [{ role: "user", content }],
      });
      return NextResponse.json({ read: normalizePhotoRead(result.object), model });
    } catch (err) {
      console.error(`[structures/photo-read] ${model} failed:`, err);
    }
  }
  return NextResponse.json({ error: "The photos could not be read. Set the roof and walls by hand." }, { status: 502 });
}
