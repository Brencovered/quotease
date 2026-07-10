import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit(`ai-chat:${user.id}`, 30, 10 * 60 * 1000);
  const rlBlocked = rateLimitResponseInit(rl);
  if (rlBlocked) return NextResponse.json(rlBlocked.body, rlBlocked.init);

  const { messages, system } = await req.json();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: err.error?.message ?? "AI error" }, { status: 502 });
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  return NextResponse.json({ text });
}
