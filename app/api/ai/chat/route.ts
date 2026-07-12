import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";
import { generateTextWithMessagesFallback, MODELS } from "@/lib/ai/gateway";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(`ai-chat:${user.id}`, 30, 10 * 60 * 1000);
  const rlBlocked = rateLimitResponseInit(rl);
  if (rlBlocked) return NextResponse.json(rlBlocked.body, rlBlocked.init);

  const { messages, system } = await req.json();

  try {
    const result = await generateTextWithMessagesFallback({
      primaryModel: MODELS.HAIKU,
      fallbackModel: MODELS.TEXT_FALLBACK,
      system,
      messages,
      maxTokens: 4096,
    });
    return NextResponse.json({ text: result.text });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI error" }, { status: 502 });
  }
}
