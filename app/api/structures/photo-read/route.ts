/**
 * POST /api/structures/photo-read
 * Reads house photos, and the floor plan when one is attached.
 * Returns suggestions for roof, walls, storeys and scale. Nothing is
 * written onto the job until the tradie accepts one.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { MODELS } from "@/lib/ai/gateway";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";
import { PHOTO_READ_PROMPT, PhotoReadSchema, normalizePhotoRead, photoSuggestions, type PhotoContext } from "@/lib/structureAi";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to Swiftscope to read photos.", signup: true }, { status: 401 });

  const rl = await checkRateLimit(`structure-photo-read:${user.id}`, 10, 10 * 60 * 1000);
  const blocked = rateLimitResponseInit(rl);
  if (blocked) return NextResponse.json(blocked.body, blocked.init);

  let body: { images?: unknown; plan?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Those photos are too big. Try fewer at a time." }, { status: 413 });
  }
  const isImg = (i: unknown): i is string => typeof i === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(i);
  const plan = isImg(body.plan) && body.plan.length <= 1_600_000 ? body.plan : "";
  const images = (Array.isArray(body.images) ? body.images : []).filter(isImg).slice(0, plan ? 3 : 4);
  const total = images.reduce((a, i) => a + i.length, 0) + plan.length;
  if (!images.length) return NextResponse.json({ error: "Add a photo of the house first." }, { status: 400 });
  if (total > 5_000_000) return NextResponse.json({ error: "Those photos are too big. Try fewer at a time." }, { status: 413 });
  const context = cleanContext(body.context);

  const content = [
    ...(plan ? [{ type: "image" as const, image: plan }] : []),
    ...images.map((image) => ({ type: "image" as const, image })),
    { type: "text" as const, text: promptText(images.length, !!plan, context, body.context) },
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
      const read = normalizePhotoRead(result.object);
      return NextResponse.json({ read, suggestions: photoSuggestions(read, context), model });
    } catch (err) {
      console.error(`[structures/photo-read] ${model} failed:`, err);
    }
  }
  return NextResponse.json({ error: "The photos could not be read. Set the roof and walls by hand." }, { status: 502 });
}

const ROOFS = new Set(["hip", "gable", "skillion", "flat"]);
const CLADS = new Set(["brick", "weatherboard", "fc", "colorbond", "render"]);

function cleanContext(raw: unknown): PhotoContext {
  const o = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const num = (k: string, lo: number, hi: number, fallback: number) => {
    const n = Number(o[k]);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
  };
  const outdoor = Array.isArray(o.outdoor)
    ? o.outdoor.map((s) => String(s).replace(/[^\w .'/+-]/g, "").trim().slice(0, 24)).filter(Boolean).slice(0, 8)
    : [];
  const roof = String(o.roofType || "");
  const clad = String(o.cladding || o.extClad || "");
  return {
    storeys: Math.round(num("storeys", 1, 3, 1)),
    wallH: num("wallH", 2100, 3600, 2400),
    extClad: CLADS.has(clad) ? clad : "brick",
    roofType: ROOFS.has(roof) ? roof : "hip",
    roofMat: o.roofMat === "colorbond" ? "colorbond" : "tiles",
    pitch: num("pitch", 1, 45, 22.5),
    eave: num("eave", 0, 900, 450),
    outdoor,
  };
}

function measuredLine(raw: unknown) {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const m = (k: string) => {
    const n = Number(o[k]);
    if (!Number.isFinite(n) || n <= 0 || n > 400) return null;
    return Math.round(n * 10) / 10;
  };
  const w = m("widthM");
  const d = m("depthM");
  const a = m("footprintM");
  if (w == null || d == null) return "";
  return ` Traced box about ${w} m by ${d} m${a != null ? `, footprint ${a} m²` : ""}.`;
}

function promptText(photos: number, plan: boolean, c: PhotoContext, raw: unknown) {
  const lead = plan
    ? photos === 1
      ? "The first image is the floor plan. The next image is a photo of the finished house."
      : `The first image is the floor plan. The next ${photos} images are photos of the finished house.`
    : photos === 1
      ? "This is a photo of the house. No floor plan is attached."
      : `These are ${photos} photos of the same house. No floor plan is attached.`;
  const outdoor = c.outdoor.length ? ` Outdoor labels already kept off the footprint: ${c.outdoor.join(", ")}.` : "";
  return `${lead}
Measured from the trace, as data: ${c.storeys} storey${c.storeys === 1 ? "" : "s"} traced, ceiling ${Math.round(c.wallH)} mm, roof ${c.roofType}, walls ${c.extClad}, pitch ${c.pitch}°, eaves ${Math.round(c.eave)} mm.${measuredLine(raw)}${outdoor}
Describe the house.`;
}
