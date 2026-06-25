import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkUsage, currentPeriod, type UsageProfile } from "@/lib/aiUsage";

// Requires an ANTHROPIC_API_KEY env var (console.anthropic.com -> API Keys).
// This is one shared key owned by the business, not something individual
// tradies need their own account for - usage is metered per-profile below
// (3 free, then gated behind the paid add-on) so the cost stays bounded
// and recoverable through the add-on subscription rather than unmetered.
const SYSTEM_PROMPT_BASE = `You are helping an electrician estimate a residential job from a floor plan or electrical drawing.

STEP 1 — Classify the drawing:
A) "electrical" — drawing contains standard AS/NZS electrical symbols (GPO outlets, light point circles, switch symbols, etc.)
B) "architectural" — drawing is a floor plan or building plan with ROOMS but NO electrical symbols
C) "other" — site photo, unclear image, or something else entirely

STEP 2 — Extract data based on type:

If type A (electrical drawing): count the symbols directly:
- Power points (GPOs)
- Light points / fittings
- Switches
- Downlights specifically (if distinguishable from general light points)
- Whether a switchboard upgrade symbol or note is visible
- Whether 3-phase supply is indicated
- Data/network points
- Smoke alarms

If type B (architectural floor plan — no electrical symbols): do NOT return all zeros. Instead:
- Count the total number of distinct rooms / spaces visible across ALL floors (include bedrooms, living, kitchen, bathrooms, hallways, laundry, garage — every defined space)
- Estimate downlights as rooms × 3 (typical new install density for Australian residential)
- Estimate switches as rooms × 1 (one switching location per room/zone)
- Estimate smoke_alarms as rooms × 1 (one interconnected photoelectric alarm per room/zone per AS 3786)
- Set power_points to 0 (cannot be determined without electrical symbols — tradie must assess on site)
- Set light_points to 0 (downlights field covers this for new install)
- Set switchboard_upgrade to false (unknown — tradie must assess switchboard capacity on site)
- Set three_phase to false (unknown)
- Set data_points to 0 (unknown)
- Set confidence to "low"
- In notes: explain this is an architectural plan with no electrical symbols, state how many rooms you counted, that all quantities are estimates only, that an on-site survey is essential to confirm ceiling construction, roof cavity access, and switchboard capacity before quoting

If type C (other): return all zeros, confidence "low", explain in notes.

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
  "notes": "<one or two sentences on anything unclear or worth the tradie double-checking on site>"
}`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on this deployment" },
      { status: 500 }
    );
  }

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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const instructions = (formData.get("instructions") as string | null)?.trim();
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const isPdf = file.type === "application/pdf";

  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: file.type || "image/png", data: base64 } };

  const systemPrompt = instructions
    ? `${SYSTEM_PROMPT_BASE}\n\nThe tradie who uploaded this drawing gave these additional instructions - follow them, they know their own job better than a generic reading of the symbols:\n"${instructions}"`
    : SYSTEM_PROMPT_BASE;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [contentBlock, { type: "text", text: "Analyse this drawing." }],
        },
      ],
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
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Could not parse a response from the drawing analysis" }, { status: 502 });
  }

  // Only meter successful analyses - a parse failure or upstream error
  // above already returned before this point, so nothing's been charged
  // against the tradie's quota for a result they didn't actually get.
  if (usage.via === "free") {
    await supabase
      .from("profiles")
      .update({ ai_free_analyses_used: profile.ai_free_analyses_used + 1 })
      .eq("id", userData.user.id);
  } else {
    const period = currentPeriod();
    const periodMatches = profile.ai_addon_period === period;
    await supabase
      .from("profiles")
      .update({
        ai_addon_period: period,
        ai_addon_analyses_used: periodMatches ? profile.ai_addon_analyses_used + 1 : 1,
      })
      .eq("id", userData.user.id);
  }

  return NextResponse.json({
    result: parsed,
    usage: { via: usage.via, remainingFree: usage.remainingFree, remainingAddon: usage.remainingAddon },
  });
}
