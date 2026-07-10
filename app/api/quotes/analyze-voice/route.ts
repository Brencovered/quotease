import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import { checkUsage, currentPeriod, type UsageProfile } from "@/lib/aiUsage";
import { getTradeVoicePrompt } from "@/lib/ai/getTradeVoicePrompt";
import { DETECTED_ITEMS_SCHEMA } from "@/lib/ai/detectedItemsSchema";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";

// Shares the same free/add-on quota as drawing analysis (lib/aiUsage.ts) -
// it's the same underlying cost (one Claude API call) and the same kind of
// assist, so a separate quota would just be confusing rather than more fair.
//
// This electrician prompt/shape is kept exactly as it was -- QuoteBuilder.tsx
// autofills its intake form directly from these fixed fields. Every other
// trade is dispatched dynamically below via getTradeVoicePrompt, returning
// detected_items instead (previously every non-electrician trade ran through
// THIS electrician-only prompt and the result was discarded but for a
// confidence badge -- voice quoting simply didn't work for them).
const ELECTRICIAN_SYSTEM_PROMPT = `You are helping a tradie turn a voice note recorded on site into a structured quote.
They walked around describing the job out loud - it'll be informal, may go off on tangents, and won't
use precise terminology. Extract what you can about an electrical job:
- Power points (GPOs)
- Light points / fittings
- Switches
- Downlights specifically (if mentioned)
- Whether a switchboard upgrade was mentioned
- Whether 3-phase supply was mentioned
- Data/network points
- Smoke alarms
- Anything that sounds like scope creep, a variation, or "while you're here" extras - note these separately,
  don't fold them into the main counts

Respond with ONLY a JSON object, no other text, in exactly this shape:
{
  "power_points": <integer>,
  "light_points": <integer>,
  "switches": <integer>,
  "downlights": <integer>,
  "switchboard_upgrade": <boolean>,
  "three_phase": <boolean>,
  "data_points": <integer>,
  "smoke_alarms": <integer>,
  "confidence": "<high|medium|low>",
  "notes": "<one or two sentences on anything unclear, plus any scope-creep/extra items mentioned that the tradie should follow up on separately>"
}

If the transcript doesn't actually describe an electrical job, set confidence to "low" and say so in notes
rather than inventing numbers.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on this deployment" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = checkRateLimit(`analyze-voice:${userData.user.id}`, 15, 10 * 60 * 1000);
  const rlBlocked = rateLimitResponseInit(rl);
  if (rlBlocked) return NextResponse.json(rlBlocked.body, rlBlocked.init);
  // AI usage quota is per-business, not per-login - otherwise a team
  // member gets (or is blocked by) their own separate, meaningless quota
  // instead of the business's real one.
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

  const { transcript, instructions, trade } = await request.json();
  if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) {
    return NextResponse.json({ error: "Transcript is too short to extract anything useful from." }, { status: 400 });
  }

  const normalisedTrade = (typeof trade === "string" ? trade : "electrician").toLowerCase().trim();
  const isElectrician = ["electrician", "electrical", "sparky", ""].includes(normalisedTrade);

  const basePrompt = isElectrician
    ? ELECTRICIAN_SYSTEM_PROMPT
    : getTradeVoicePrompt(normalisedTrade) + DETECTED_ITEMS_SCHEMA;

  const systemPrompt = instructions?.trim()
    ? `${basePrompt}\n\nThe tradie also gave this instruction - follow it:\n"${instructions.trim()}"`
    : basePrompt;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: `Voice note transcript:\n\n"${transcript}"` }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: `Claude API error: ${body}` }, { status: 502 });
  }

  const data = await res.json();
  const text = data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";

  let parsed;
  try {
    const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch {
    return NextResponse.json({ error: "Could not parse a response from the voice note." }, { status: 502 });
  }

  if (usage.via === "free") {
    await supabase.from("profiles").update({ ai_free_analyses_used: profile.ai_free_analyses_used + 1 }).eq("id", businessId);
  } else {
    const period = currentPeriod();
    const periodMatches = profile.ai_addon_period === period;
    await supabase
      .from("profiles")
      .update({ ai_addon_period: period, ai_addon_analyses_used: periodMatches ? profile.ai_addon_analyses_used + 1 : 1 })
      .eq("id", businessId);
  }

  return NextResponse.json({ result: parsed, usage: { via: usage.via } });
}
