/**
 * lib/ai/gateway.ts
 * -----------------
 * All AI requests route through Vercel AI Gateway.
 *
 * Auth:
 *   - Production: Vercel injects OIDC token automatically -- no config needed
 *   - Local dev:  Set AI_GATEWAY_API_KEY in .env.local (from Vercel dashboard
 *                 under AI Gateway > API Keys)
 *
 * NO direct OpenAI or Anthropic keys -- everything goes through the gateway.
 * Model strings like "openai/gpt-4o-mini" are resolved by the gateway.
 */

import { generateText, generateObject, streamText } from "ai";
import { type ZodSchema } from "zod";

// Only used for local dev -- Vercel injects auth automatically in production
if (process.env.AI_GATEWAY_API_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
}

export const MODELS = {
  TEXT_PRIMARY:    "openai/gpt-4o-mini",
  TEXT_FALLBACK:   "anthropic/claude-3-haiku",
  VISION_PRIMARY:  "openai/gpt-4o",
  VISION_FALLBACK: "anthropic/claude-3-5-sonnet",
  // Used by the chat, business-assistant, and analyze-voice routes below.
  //
  // These were "anthropic/claude-haiku-4.5" and "anthropic/claude-sonnet-4.6"
  // from when this constant was introduced (364f82d) until now. Both are
  // versions nobody had confirmed the gateway account could actually reach --
  // they were typed fresh for these three routes rather than reusing
  // TEXT_FALLBACK/VISION_FALLBACK two lines up, which were already proven
  // working. Every request through chat, business-assistant and
  // analyze-voice failed at 403 "Free tier users do not have access to this
  // model" from the day this file was created, primary and fallback both,
  // which is why the assistant "stopped working" with no code change on the
  // user's part: it never worked on this account, this constant just hadn't
  // shipped to a route someone was actively using until later.
  //
  // Pointed at the same models VISION_FALLBACK and TEXT_FALLBACK already use
  // and which the account has confirmed access to. If a newer Claude model
  // is wanted here, verify it against GET /api/admin/ai/models first -- that
  // endpoint exists specifically because guessing at a version string is
  // what caused this.
  HAIKU:  "anthropic/claude-3-haiku",
  SONNET: "anthropic/claude-3-5-sonnet",
} as const;

/**
 * generateText over a full multi-turn message list (as opposed to a single
 * prompt string) with automatic fallback. Used by routes that carry actual
 * conversation history rather than a one-shot instruction.
 */
export async function generateTextWithMessagesFallback(opts: {
  primaryModel:  string;
  fallbackModel: string;
  system?:       string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages:      any[];
  maxTokens?: number;
}) {
  for (const model of [opts.primaryModel, opts.fallbackModel]) {
    try {
      const result = await generateText({
        model,
        system: opts.system,
        messages: opts.messages,
        maxOutputTokens: opts.maxTokens ?? 2048,
      });
      return { text: result.text, model, usage: result.usage };
    } catch (err) {
      console.error(`[AI Gateway] ${model} failed:`, err);
      if (model === opts.fallbackModel) throw err;
      console.warn(`[AI Gateway] Falling back to ${opts.fallbackModel}`);
    }
  }
  throw new Error("All models failed");
}

/**
 * generateText with automatic fallback.
 */
export async function generateWithFallback(opts: {
  primaryModel:  string;
  fallbackModel: string;
  system:        string;
  prompt:        string;
  maxTokens?: number;
}) {
  for (const model of [opts.primaryModel, opts.fallbackModel]) {
    try {
      const result = await generateText({
        model,
        system:    opts.system,
        prompt:    opts.prompt,
        maxOutputTokens: opts.maxTokens ?? 1024,
      });
      return { text: result.text, model, usage: result.usage };
    } catch (err) {
      console.error(`[AI Gateway] ${model} failed:`, err);
      if (model === opts.fallbackModel) throw err;
      console.warn(`[AI Gateway] Falling back to ${opts.fallbackModel}`);
    }
  }
  throw new Error("All models failed");
}

/**
 * generateObject with automatic fallback.
 * Returns structured JSON matching the provided Zod schema.
 */
export async function generateObjectWithFallback<T>(opts: {
  primaryModel:  string;
  fallbackModel: string;
  system:        string;
  prompt:        string;
  schema:        ZodSchema<T>;
}) {
  for (const model of [opts.primaryModel, opts.fallbackModel]) {
    try {
      const result = await generateObject({
        model,
        system: opts.system,
        prompt: opts.prompt,
        schema: opts.schema,
      });
      return { object: result.object, model, usage: result.usage };
    } catch (err) {
      console.error(`[AI Gateway] ${model} failed:`, err);
      if (model === opts.fallbackModel) throw err;
      console.warn(`[AI Gateway] Falling back to ${opts.fallbackModel}`);
    }
  }
  throw new Error("All models failed");
}

/**
 * streamText with automatic fallback.
 */
export async function streamWithFallback(opts: {
  primaryModel:  string;
  fallbackModel: string;
  system:        string;
  prompt:        string;
  maxTokens?: number;
}) {
  for (const model of [opts.primaryModel, opts.fallbackModel]) {
    try {
      return streamText({
        model,
        system:    opts.system,
        prompt:    opts.prompt,
        maxOutputTokens: opts.maxTokens ?? 1024,
      });
    } catch (err) {
      console.error(`[AI Gateway] ${model} failed:`, err);
      if (model === opts.fallbackModel) throw err;
      console.warn(`[AI Gateway] Falling back to ${opts.fallbackModel}`);
    }
  }
  throw new Error("All models failed");
}
