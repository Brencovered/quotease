/**
 * GET /api/admin/ai/models
 * ------------------------
 * Lists the models this account can actually reach through the Vercel AI
 * Gateway, with pricing, straight from the gateway itself.
 *
 * Why this exists. Five routes were failing with:
 *
 *   Free tier users do not have access to this model. statusCode: 403
 *
 * for both MODELS.SONNET ("anthropic/claude-sonnet-4.6") and MODELS.HAIKU
 * ("anthropic/claude-haiku-4.5"). Read at face value that is a billing
 * problem, but the gateway returns the same shape of error for a model ID it
 * cannot resolve at all, and those two strings do not match the current
 * naming in Vercel's own docs. Guessing between "the account needs credits"
 * and "the model IDs are stale" is exactly the kind of assumption that wastes
 * a day, so this asks the source.
 *
 * Hit it as an admin and you get the definitive list. If Claude models appear
 * here, the IDs in lib/ai/gateway.ts are wrong and need updating to whatever
 * is listed. If nothing from Anthropic appears, or the call itself fails on
 * auth, then it genuinely is account access.
 *
 * Kept as a diagnostic rather than something the app depends on at runtime.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { MODELS } from "@/lib/ai/gateway";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json(
      { error: "AI_GATEWAY_API_KEY is not set in this environment" },
      { status: 500 }
    );
  }

  try {
    // Documented REST endpoint rather than the gateway SDK helper:
    // @ai-sdk/gateway is not a direct dependency here, and a plain fetch has
    // no version coupling to get wrong.
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          error: `Gateway returned ${res.status}`,
          hint:
            res.status === 401 || res.status === 403
              ? "Auth or account level, not the model strings."
              : "Unexpected gateway response.",
          detail: text.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const payload = (await res.json()) as { data?: { id: string }[]; models?: { id: string }[] };
    const ids = (payload.data ?? payload.models ?? []).map((m) => m.id).filter(Boolean);

    // The decisive number. The gateway dashboard confirmed both model ids
    // resolve and both were rejected at zero tokens and zero cost, so this is
    // entitlement rather than a bad string. Balance separates the two
    // remaining explanations: a spent free allocation, which a top-up fixes,
    // or a per-model restriction that a top-up also fixes but for a different
    // reason. Either way, stop guessing and read it.
    let credits: unknown = null;
    try {
      const cRes = await fetch("https://ai-gateway.vercel.sh/v1/credits", {
        headers: {
          Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });
      credits = cRes.ok
        ? await cRes.json()
        : { error: `credits endpoint returned ${cRes.status}`, detail: (await cRes.text()).slice(0, 200) };
    } catch (e) {
      credits = { error: e instanceof Error ? e.message : String(e) };
    }

    // Which of the IDs the app actually asks for are real.
    const configured = Object.entries(MODELS).map(([key, id]) => ({
      key,
      id,
      resolves: ids.includes(id),
    }));

    return NextResponse.json({
      credits,
      totalAvailable: ids.length,
      configured,
      anthropic: ids.filter((id) => id.startsWith("anthropic/")),
      openai: ids.filter((id) => id.startsWith("openai/")),
      google: ids.filter((id) => id.startsWith("google/")),
      allIds: ids,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/ai/models] gateway list failed:", message);
    // A failure here is itself the answer: if listing models fails on auth,
    // the key or the account is the problem, not the model strings.
    return NextResponse.json(
      { error: "Could not list gateway models", detail: message.slice(0, 500) },
      { status: 502 }
    );
  }
}
