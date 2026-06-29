/**
 * lib/ai/gateway.ts
 * -----------------
 * Vercel AI Gateway helpers for Swiftscope.
 *
 * Uses the Vercel AI SDK gateway syntax -- model strings are passed directly
 * as "{provider}/{model}" and the gateway handles routing, failover, and
 * cost tracking automatically.
 *
 * Per-customer spend tracking is handled via the AI_GATEWAY_METADATA env var
 * or by passing custom headers in the request.
 */

import { generateText, generateObject, streamText } from "ai";
import { type ZodSchema } from "zod";

export const MODELS = {
  // Fast + cheap -- text/voice quote parsing
  TEXT_PRIMARY:  "openai/gpt-4o-mini",
  TEXT_FALLBACK: "anthropic/claude-3-haiku",

  // Vision -- drawing/blueprint analysis
  VISION_PRIMARY:  "openai/gpt-4o",
  VISION_FALLBACK: "anthropic/claude-3-5-sonnet",
} as const;

/**
 * generateText with automatic fallback.
 * Tries primary model first, falls back on any error.
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
 * Returns a streaming response -- use for real-time UI updates.
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
