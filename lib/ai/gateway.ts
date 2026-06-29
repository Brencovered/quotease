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
} as const;

/**
 * generateText with automatic fallback.
 */
export async function generateWithFallback(opts: {
  primaryModel:  string;
  fallbackModel: string;
  system:        string;
  prompt:        string;
  maxTokens?:    number;
}) {
  for (const model of [opts.primaryModel, opts.fallbackModel]) {
    try {
      const result = await generateText({
        model,
        system:    opts.system,
        prompt:    opts.prompt,
        maxTokens: opts.maxTokens ?? 1024,
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
  maxTokens?:    number;
}) {
  for (const model of [opts.primaryModel, opts.fallbackModel]) {
    try {
      return streamText({
        model,
        system:    opts.system,
        prompt:    opts.prompt,
        maxTokens: opts.maxTokens ?? 1024,
      });
    } catch (err) {
      console.error(`[AI Gateway] ${model} failed:`, err);
      if (model === opts.fallbackModel) throw err;
      console.warn(`[AI Gateway] Falling back to ${opts.fallbackModel}`);
    }
  }
  throw new Error("All models failed");
}
