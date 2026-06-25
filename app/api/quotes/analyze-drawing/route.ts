import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Requires an ANTHROPIC_API_KEY env var (console.anthropic.com -> API Keys).
// This is a genuinely separate cost line from everything else in this app -
// each analysis is one API call with an image/PDF attached, typically a few
// cents. Not free, but cheap enough that it's worth metering usage per
// tradie eventually rather than treating it as unlimited.
const SYSTEM_PROMPT = `You are helping an electrician estimate a residential job from a floor plan or electrical drawing.
Look at the attached drawing and count standard AS/NZS electrical symbols:
- Power points (GPOs)
- Light points / fittings
- Switches
- Downlights specifically (if distinguishable from general light points)
- Whether a switchboard upgrade symbol or note is visible
- Whether 3-phase supply is indicated
- Data/network points
- Smoke alarms

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
  "notes": "<one sentence on anything unclear or worth the tradie double-checking on site>"
}

If the drawing is unclear, low-resolution, or doesn't look like an electrical/floor plan at all, set confidence to "low" and explain in notes rather than guessing wildly at numbers.`;

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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const isPdf = file.type === "application/pdf";

  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: file.type || "image/png", data: base64 } };

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
      system: SYSTEM_PROMPT,
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
    // Strip markdown code fences if the model wrapped the JSON despite instructions.
    const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Could not parse a response from the drawing analysis" }, { status: 502 });
  }

  return NextResponse.json({ result: parsed });
}
