import { NextRequest, NextResponse } from "next/server";
import { toUserFacingError } from "@/lib/ai/userFacingError";
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
    // Never return the provider's own message: the chat UI renders this field
    // as the assistant's reply, so a gateway billing error became customer
    // facing product output. See lib/ai/userFacingError.
    const ufe = toUserFacingError(err, "ai/chat");
    return NextResponse.json({ error: ufe.message, kind: ufe.kind }, { status: ufe.status });
  }
}
