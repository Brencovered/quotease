import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkUsage, currentPeriod, type UsageProfile } from "@/lib/aiUsage";
import { getTradeSystemPrompt } from "@/lib/ai/getTradeSystemPrompt";

// Routes through Vercel AI Gateway -- no direct provider keys needed.
// In production, Vercel injects OIDC auth automatically.
// For local dev, set AI_GATEWAY_API_KEY in .env.local

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("ai_free_analyses_used, ai_addon_status, ai_addon_period, ai_addon_analyses_used")
    .eq("id", userData.user.id)
    .single();
  if (profileError || !profile) {
    return NextResponse.json({ error: "Could not load account" }, { status: 500 });
  }

  const usage = checkUsage(profile as UsageProfile);
  if (!usage.allowed) {
    return NextResponse.json({ error: usage.reason, usageLimitReached: true }, { status: 402 });
  }

  const formData    = await request.formData();
  const file        = formData.get("file") as File | null;
  const instructions = (formData.get("instructions") as string | null)?.trim();
  const trade       = (formData.get("trade") as string | null)?.trim() ?? "electrician";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const SUPPORTED_TYPES = ["image/jpeg","image/png","image/gif","image/webp","application/pdf"];
  if (!SUPPORTED_TYPES.includes(file.type)) {
    return NextResponse.json({
      error: `Unsupported file format (${file.type || "unknown"}). Use JPEG, PNG, GIF, WebP, or PDF.`,
    }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64      = Buffer.from(arrayBuffer).toString("base64");
  const isPdf       = file.type === "application/pdf";

  // Get the trade-specific expert system prompt
  const tradePrompt = getTradeSystemPrompt(trade);

  // Spec: return detected items as an array for the review table
  // instead of pre-filling individual form fields
  const outputSchema = `

After your expert analysis, output a JSON object with these two fields:

{
  "detected_items": [
    { "label": "Downlight", "item_key": "dl", "quantity": <integer>, "unit": "each" },
    { "label": "Power point (GPO)", "item_key": "gpo", "quantity": <integer>, "unit": "each" },
    ...
  ],
  "notes": "<verification warnings and caveats in trade vernacular>",
  "confidence": "<high|medium|low>"
}

Rules for detected_items:
- Only include items with quantity > 0
- Collate the same item type into one row (e.g. all downlights = one row with total count)
- Use these item_key values to match the price book:
  dl (downlights), gpo (power points), sw (switches), data (data points),
  exhaust (exhaust fans), smoke (smoke alarms), cable (cable runs, unit=m),
  conduit (conduit runs, unit=m), sb (switchboard), circuit (new circuits),
  tap, toilet, basin, shower, hwu, pipe_cold, pipe_hot, pipe_waste,
  gutter, downpipe, ridge, valley, fascia, skylight, whirlybird, roof_area,
  wall_frame, door, window, skirting, decking
- For metre-based items (cable, conduit, pipe runs, gutters), set unit to "m" and estimate total metres
- For area items (roof sections), set unit to "m2"

Output ONLY the JSON object. No other text before or after it.`;

  const systemPrompt = tradePrompt
    + (instructions ? `\n\nAdditional tradie instructions (follow these -- they know their own job):\n"${instructions}"` : "")
    + outputSchema;

  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image",    source: { type: "base64", media_type: file.type,          data: base64 } };

  // Try primary model (claude-sonnet via gateway), fallback to claude-haiku
  const models = ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"];
  let lastError = "";

  for (const model of models) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         process.env.ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: "user", content: [contentBlock, { type: "text", text: "Analyse this drawing." }] }],
        }),
      });

      if (!res.ok) {
        lastError = `Model ${model} returned ${res.status}`;
        continue;
      }

      const data = await res.json();
      const text = data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";

      let parsed;
      try {
        const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
        // Extract JSON object from the response in case there's surrounding text
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
      } catch {
        lastError = "Could not parse JSON from model response";
        continue;
      }

      // Update usage counters
      if (usage.via === "free") {
        await supabase.from("profiles")
          .update({ ai_free_analyses_used: profile.ai_free_analyses_used + 1 })
          .eq("id", userData.user.id);
      } else {
        const period = currentPeriod();
        const periodMatches = profile.ai_addon_period === period;
        await supabase.from("profiles").update({
          ai_addon_period:       period,
          ai_addon_analyses_used: periodMatches ? profile.ai_addon_analyses_used + 1 : 1,
        }).eq("id", userData.user.id);
      }

      return NextResponse.json({
        result: parsed,
        model,
        usage: { via: usage.via, remainingFree: usage.remainingFree, remainingAddon: usage.remainingAddon },
      });

    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      console.error(`[analyze-drawing] ${model} failed:`, lastError);
    }
  }

  return NextResponse.json({ error: `Drawing analysis failed: ${lastError}` }, { status: 502 });
}
