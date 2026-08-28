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
import { isGatewayRateLimitError } from "@/lib/ai/formatAiGatewayError";

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
const TEXT_FLASH = "google/gemini-2.5-flash-lite";
const TEXT_NOVA = "amazon/nova-micro";
const TEXT_QWEN = "alibaba/qwen3.7-flash";
const VISION_PRIMARY = "openai/gpt-4o";
const VISION_FALLBACK = "anthropic/claude-3-5-sonnet";

export const MODELS = {
  TEXT_PRIMARY,
  TEXT_FALLBACK,
  TEXT_FLASH,
  TEXT_NOVA,
  TEXT_QWEN,
  VISION_PRIMARY,
  VISION_FALLBACK,
  HAIKU: TEXT_FALLBACK,
  SONNET: VISION_FALLBACK,
} as const;

/** Cheap text models on separate Gateway free-tier RPM buckets. */
export const TEXT_MODELS = [
  TEXT_PRIMARY,
  TEXT_FLASH,
  TEXT_NOVA,
  TEXT_QWEN,
  TEXT_FALLBACK,
] as const;

export function textModelsFrom(offset = 0): string[] {
  const list = [...TEXT_MODELS];
  const n = list.length;
  if (n === 0) return list;
  const i = ((offset % n) + n) % n;
  return [...list.slice(i), ...list.slice(0, i)];
}

function uniqueModels(...ids: Array<string | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => !!id))];
}

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
  const models = uniqueModels(opts.primaryModel, opts.fallbackModel);
  for (const model of models) {
    try {
      const result = await generateText({
        model,
        system: opts.system,
        messages: opts.messages,
        maxOutputTokens: opts.maxTokens ?? 2048,
        maxRetries: 0,
      });
      return { text: result.text, model, usage: result.usage };
    } catch (err) {
      console.error(`[AI Gateway] ${model} failed:`, err);
      if (model === models[models.length - 1]) throw err;
      const next = models[models.indexOf(model) + 1];
      console.warn(`[AI Gateway] Falling back to ${next}`);
    }
  }
  throw new Error("All models failed");
}

/**
 * generateText with automatic fallback.
 */
export async function generateWithFallback(opts: {
  primaryModel?:  string;
  fallbackModel?: string;
  models?:        string[];
  system:        string;
  prompt:        string;
  maxTokens?: number;
  /** After this many 429s in one call, stop so we do not empty every RPM bucket. */
  maxRateLimitHops?: number;
}) {
  const models = uniqueModels(...(opts.models ?? [opts.primaryModel, opts.fallbackModel]));
  const maxHops = opts.maxRateLimitHops ?? models.length;
  let rateLimitHops = 0;
  for (const model of models) {
    try {
      const result = await generateText({
        model,
        system:    opts.system,
        prompt:    opts.prompt,
        maxOutputTokens: opts.maxTokens ?? 1024,
        maxRetries: 0,
      });
      return { text: result.text, model, usage: result.usage };
    } catch (err) {
      console.error(`[AI Gateway] ${model} failed:`, err);
      if (isGatewayRateLimitError(err)) {
        rateLimitHops += 1;
        if (rateLimitHops >= maxHops) throw err;
      }
      if (model === models[models.length - 1]) throw err;
      const next = models[models.indexOf(model) + 1];
      console.warn(`[AI Gateway] Falling back to ${next}`);
    }
  }
  throw new Error("All models failed");
}

/**
 * Structured JSON with automatic fallback.
 * generateObject was removed in AI SDK v6; this uses generateText + Output.object.
 */
export async function generateObjectWithFallback<T>(opts: {
  primaryModel?:  string;
  fallbackModel?: string;
  models?:        string[];
  system:        string;
  prompt:        string;
  schema:        ZodSchema<T>;
}) {
  const models = uniqueModels(...(opts.models ?? [opts.primaryModel, opts.fallbackModel]));
  for (const model of models) {
    try {
      const result = await generateText({
        model,
        system: opts.system,
        prompt: opts.prompt,
        output: Output.object({ schema: opts.schema }),
        maxRetries: 0,
      });
      if (result.output == null) {
        throw new Error("Model returned no structured output");
      }
      return { object: result.output, model, usage: result.usage };
    } catch (err) {
      console.error(`[AI Gateway] ${model} failed:`, err);
      if (model === models[models.length - 1]) throw err;
      const next = models[models.indexOf(model) + 1];
      console.warn(`[AI Gateway] Falling back to ${next}`);
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
  const models = uniqueModels(opts.primaryModel, opts.fallbackModel);
  for (const model of models) {
    try {
      return streamText({
        model,
        system:    opts.system,
        prompt:    opts.prompt,
        maxOutputTokens: opts.maxTokens ?? 1024,
        maxRetries: 0,
      });
    } catch (err) {
      console.error(`[AI Gateway] ${model} failed:`, err);
      if (model === models[models.length - 1]) throw err;
      const next = models[models.indexOf(model) + 1];
      console.warn(`[AI Gateway] Falling back to ${next}`);
    }
  }
  throw new Error("All models failed");
}
