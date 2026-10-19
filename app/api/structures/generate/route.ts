/**
 * POST /api/structures/generate
 * Describe-to-build for the build planner. Signed-in businesses only.
 *
 * Input:  { description: string, current?: { shed, openings, items } }
 * Output: { plan: NormalizedPlan } with sizes in mm, ready for the planner.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateObjectWithFallback, MODELS } from "@/lib/ai/gateway";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";
import {
  GeneratedPlanSchema,
  STRUCTURE_SYSTEM_PROMPT,
  normalizeGeneratedPlan,
  type GeneratedPlan,
} from "@/lib/structureAi";

export const maxDuration = 60;

function describeCurrent(current: unknown): string {
  if (!current || typeof current !== "object") return "";
  const c = current as { shed?: Record<string, unknown>; openings?: unknown[]; items?: unknown[] };
  if (!c.shed) return "";
  const pick = (o: Record<string, unknown>, keys: string[]) =>
    Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
  const shed = pick(c.shed, [
    "width", "length", "height", "roof", "roofDir", "pitch", "overhang", "studSize", "studSpacing",
    "rafterSize", "rafterSpacing", "floor", "slabT", "mesh", "floorSheet", "floorH", "paverType",
    "gravelType", "wallMat", "roofMat", "wallColor", "roofColor", "doorColor",
  ]);
  const openings = (Array.isArray(c.openings) ? c.openings : []).slice(0, 16).map((o) =>
    pick(o as Record<string, unknown>, ["type", "wall", "offset", "width", "height", "sill", "build"])
  );
  const items = (Array.isArray(c.items) ? c.items : []).slice(0, 24).map((i) =>
    pick(i as Record<string, unknown>, ["name", "w", "d", "h", "x", "z", "rot"])
  );
  return JSON.stringify({ shed, openings, items });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to Swiftscope to build from a description.", signup: true },
      { status: 401 }
    );
  }

  const rl = await checkRateLimit(`structure-generate:${user.id}`, 20, 10 * 60 * 1000);
  const blocked = rateLimitResponseInit(rl);
  if (blocked) return NextResponse.json(blocked.body, blocked.init);

  let body: { description?: unknown; current?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) return NextResponse.json({ error: "Describe the build first." }, { status: 400 });
  if (description.length > 2000) return NextResponse.json({ error: "Keep the description under 2,000 characters." }, { status: 400 });

  const current = describeCurrent(body.current);
  const prompt = current
    ? `Current design (mm):\n${current}\n\nRequest:\n${description}`
    : `Request:\n${description}`;

  try {
    const result = await generateObjectWithFallback<GeneratedPlan>({
      models: [MODELS.VISION_PRIMARY, MODELS.TEXT_PRIMARY, MODELS.TEXT_FALLBACK],
      system: STRUCTURE_SYSTEM_PROMPT,
      prompt,
      schema: GeneratedPlanSchema,
    });
    return NextResponse.json({ plan: normalizeGeneratedPlan(result.object), model: result.model });
  } catch (err) {
    console.error("[structures/generate] failed:", err);
    return NextResponse.json({ error: "Could not build that one. Try rewording it." }, { status: 502 });
  }
}
