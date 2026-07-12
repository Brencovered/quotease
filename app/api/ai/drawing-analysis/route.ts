/**
 * POST /api/ai/drawing-analysis
 * ------------------------------
 * Processes an uploaded site plan or drawing image and returns structured
 * data: item counts, room/zone layout, and suggested quote line items.
 *
 * Input:  multipart/form-data { image: File, trade: string, instructions?: string }
 * Output: { rooms, items, line_items, notes, model }
 *
 * Example: Upload a floor plan for an electrician.
 * Output might be:
 *   rooms: ["kitchen", "living", "bed1", "bed2", "bed3", "bathroom"]
 *   items: [{ name: "power point", count: 24 }, { name: "light", count: 18 }]
 *   line_items: [{ description: "Supply & install GPO", quantity: 24, unit: "each" }]
 */

import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MODELS } from "@/lib/ai/gateway";
import { getTradeSystemPrompt } from "@/lib/ai/getTradeSystemPrompt";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";

// ── Schema ─────────────────────────────────────────────────────────────────

const DrawingSchema = z.object({
  rooms: z.array(z.string()).describe("List of rooms or zones identified in the drawing"),
  items: z.array(z.object({
    name:  z.string().describe("Item type e.g. 'downlight DL1', 'GPO-USB', 'WC-2'"),
    count: z.number().describe("Number of this item visible in the drawing"),
    notes: z.string().describe("Location, spec code, or clarification notes"),
  })).describe("All countable items found in the drawing, using exact legend codes"),
  line_items: z.array(z.object({
    description: z.string(),
    quantity:    z.number(),
    unit:        z.enum(["each","m","m2","hr","lot","point"]),
    notes:       z.string(),
  })).describe("Suggested quote line items based on the drawing"),
  confidence: z.enum(["high","medium","low"]).describe("Confidence level of the analysis"),
  notes: z.string().describe("On-site verification warnings and caveats in trade vernacular"),
});

type DrawingOutput = z.infer<typeof DrawingSchema>;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(`drawing-analysis:${user.id}`, 10, 10 * 60 * 1000);
  const rlBlocked = rateLimitResponseInit(rl);
  if (rlBlocked) return NextResponse.json(rlBlocked.body, rlBlocked.init);

  const formData    = await req.formData();
  const imageFile   = formData.get("image") as File | null;
  const trade       = (formData.get("trade") as string) ?? "electrician";
  const instructions = formData.get("instructions") as string | null;

  if (!imageFile) {
    return NextResponse.json({ error: "image is required" }, { status: 400 });
  }

  if (imageFile.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 400 });
  }

  // Convert to base64 for the vision model
  const buffer     = await imageFile.arrayBuffer();
  const base64     = Buffer.from(buffer).toString("base64");
  const mimeType   = imageFile.type || "image/jpeg";

  for (const model of [MODELS.VISION_PRIMARY, MODELS.VISION_FALLBACK]) {
    try {
      const result = await generateObject({
        model,
        schema: DrawingSchema,
        messages: [
          {
            role: "system",
            content: getTradeSystemPrompt(trade) + (instructions ? `\n\nAdditional instructions: ${instructions}` : ""),
          },
          {
            role: "user",
            content: [
              {
                type: "image",
                image: `data:${mimeType};base64,${base64}`,
              },
              {
                type: "text",
                text: `Analyse this ${trade} drawing and extract all relevant items and suggested quote line items.`,
              },
            ],
          },
        ],
      });

      return NextResponse.json({
        rooms:      result.object.rooms,
        items:      result.object.items,
        line_items: result.object.line_items,
        confidence: result.object.confidence,
        notes:      result.object.notes,
        model,
        usage:      result.usage,
      });

    } catch (err) {
      console.error(`[drawing-analysis] ${model} failed:`, err);
      if (model === MODELS.VISION_FALLBACK) {
        return NextResponse.json(
          { error: "AI processing failed. Please try again." },
          { status: 500 }
        );
      }
      console.warn(`[drawing-analysis] Falling back to ${MODELS.VISION_FALLBACK}`);
    }
  }
}
