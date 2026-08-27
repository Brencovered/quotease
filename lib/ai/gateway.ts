/**
 * lib/ai/gateway.ts
 * -----------------
 * All AI requests route through Vercel AI Gateway.
 *
 * Auth:
 *   - Production: Vercel injects OIDC token automatically - no config needed
 *   - Local dev:  Set AI_GATEWAY_API_KEY in .env.local (from Vercel dashboard
 *                 under AI Gateway > API Keys)
 *
 * NO direct OpenAI or Anthropic keys - everything goes through the gateway.
 * Model strings like "openai/gpt-4o-mini" are resolved by the gateway.
 */

import { generateText, Output, streamText } from "ai";
import { type ZodSchema } from "zod";

// Only used for local dev - Vercel injects auth automatically in production
if (process.env.AI_GATEWAY_API_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
}

// Keep HAIKU/SONNET as aliases of the Gateway-accessible IDs. This account's
// AI Gateway key is rejected on newer Anthropic IDs (haiku-4.5 / sonnet-4.6)
// with 403 "Free tier users do not have access to this model", which made
// blog outline assist, chat, and analyze-voice return HTTP 500.
const TEXT_PRIMARY = "openai/gpt-4o-mini";
const TEXT_FALLBACK = "anthropic/claude-3-haiku";
const VISION_PRIMARY = "openai/gpt-4o";
const VISION_FALLBACK = "anthropic/claude-3-5-sonnet";

export const MODELS = {
  TEXT_PRIMARY,
  TEXT_FALLBACK,
  VISION_PRIMARY,
  VISION_FALLBACK,
  HAIKU: TEXT_FALLBACK,
  SONNET: VISION_FALLBACK,
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
  const models = [...new Set([opts.primaryModel, opts.fallbackModel])];
  for (const model of models) {
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
      if (model === models[models.length - 1]) throw err;
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
  const models = [...new Set([opts.primaryModel, opts.fallbackModel])];
  for (const model of models) {
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
      if (model === models[models.length - 1]) throw err;
      console.warn(`[AI Gateway] Falling back to ${opts.fallbackModel}`);
    }
  }
  throw new Error("All models failed");
}

/**
 * Structured JSON with automatic fallback.
 * generateObject was removed in AI SDK v6; this uses generateText + Output.object.
 */
export async function generateObjectWithFallback<T>(opts: {
  primaryModel:  string;
  fallbackModel: string;
  system:        string;
  prompt:        string;
  schema:        ZodSchema<T>;
}) {
  const models = [...new Set([opts.primaryModel, opts.fallbackModel])];
  for (const model of models) {
    try {
      const result = await generateText({
        model,
        system: opts.system,
        prompt: opts.prompt,
        output: Output.object({ schema: opts.schema }),
      });
      if (result.output == null) {
        throw new Error("Model returned no structured output");
      }
      return { object: result.output, model, usage: result.usage };
    } catch (err) {
      console.error(`[AI Gateway] ${model} failed:`, err);
      if (model === models[models.length - 1]) throw err;
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
  const models = [...new Set([opts.primaryModel, opts.fallbackModel])];
  for (const model of models) {
    try {
      return streamText({
        model,
        system:    opts.system,
        prompt:    opts.prompt,
        maxOutputTokens: opts.maxTokens ?? 1024,
      });
    } catch (err) {
      console.error(`[AI Gateway] ${model} failed:`, err);
      if (model === models[models.length - 1]) throw err;
      console.warn(`[AI Gateway] Falling back to ${opts.fallbackModel}`);
    }
  }
  throw new Error("All models failed");
}
