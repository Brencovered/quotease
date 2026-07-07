import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import { checkUsage, currentPeriod, type UsageProfile } from "@/lib/aiUsage";
import { getTradeSystemPrompt } from "@/lib/ai/getTradeSystemPrompt";
import { DETECTED_ITEMS_SCHEMA } from "@/lib/ai/detectedItemsSchema";

// Routes through Vercel AI Gateway -- no direct provider keys needed.
// In production, Vercel injects OIDC auth automatically.
// For local dev, set AI_GATEWAY_API_KEY in .env.local

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("ai_free_analyses_used, ai_addon_status, ai_addon_period, ai_addon_analyses_used, ai_analyses_limit_override")
    .eq("id", businessId)
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

  const systemPrompt = tradePrompt
    + (instructions ? `\n\nAdditional tradie instructions (follow these -- they know their own job):\n"${instructions}"` : "")
    + DETECTED_ITEMS_SCHEMA;

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
          .eq("id", businessId);
      } else {
        const period = currentPeriod();
        const periodMatches = profile.ai_addon_period === period;
        await supabase.from("profiles").update({
          ai_addon_period:       period,
          ai_addon_analyses_used: periodMatches ? profile.ai_addon_analyses_used + 1 : 1,
        }).eq("id", businessId);
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
