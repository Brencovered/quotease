/**
 * Map AI Gateway / AI SDK failures into short admin-facing messages.
 * The blog assist UI only shows `error` from the JSON body, so a generic
 * "Planning failed" hides whether auth, credits, or the model blew up.
 *
 * AI SDK wraps provider failures in RetryError (lastError / errors[]), so
 * we walk the chain rather than reading only the outer message.
 */

type Walked = { name: string; statusCode?: number; message: string };

function walkError(err: unknown): Walked {
  const seen = new Set<unknown>();
  const parts: string[] = [];
  let name = "";
  let statusCode: number | undefined;

  const visit = (value: unknown) => {
    if (value == null || seen.has(value)) return;
    if (typeof value === "string") {
      parts.push(value);
      return;
    }
    if (typeof value !== "object") return;
    seen.add(value);
    const o = value as Record<string, unknown>;
    if (typeof o.name === "string" && !name) name = o.name;
    if (typeof o.statusCode === "number" && statusCode === undefined) {
      statusCode = o.statusCode;
    }
    if (typeof o.type === "string") parts.push(o.type);
    if (typeof o.message === "string") parts.push(o.message);
    visit(o.lastError);
    visit(o.cause);
    if (Array.isArray(o.errors)) {
      for (const nested of o.errors) visit(nested);
    }
  };

  visit(err);
  return { name, statusCode, message: parts.join("\n") };
}

export function isGatewayRateLimitError(err: unknown): boolean {
  const { name, statusCode, message } = walkError(err);
  return (
    statusCode === 429 ||
    name === "GatewayRateLimitError" ||
    /rate_limit_exceeded|GatewayRateLimitError|rate-?limited/i.test(message) ||
    /Free tier requests on this model are rate-limited/i.test(message)
  );
}

export function aiGatewayHttpStatus(err: unknown): number {
  return isGatewayRateLimitError(err) ? 429 : 500;
}

export function formatAiGatewayError(err: unknown): string {
  const { name, statusCode, message } = walkError(err);

  if (
    name === "GatewayAuthenticationError" ||
    /Unauthenticated request to AI Gateway/i.test(message) ||
    /AI_GATEWAY_API_KEY/i.test(message)
  ) {
    return "AI Gateway is not authenticated. Set AI_GATEWAY_API_KEY in the Vercel project env (AI Gateway > API Keys), or confirm OIDC is enabled for this deployment.";
  }

  if (isGatewayRateLimitError(err)) {
    return "AI Gateway free tier is rate-limiting this model. Wait a minute and try again, or top up AI Gateway credits in the Vercel dashboard (AI Gateway > top up) so drafting is not throttled.";
  }

  if (
    /insufficient.?credit|payment.?required|billing|quota/i.test(message) ||
    name === "GatewayCreditsError"
  ) {
    return "AI Gateway has no credits (or billing is blocked). Top up AI Gateway credits in the Vercel dashboard.";
  }

  if (
    statusCode === 403 ||
    /Free tier users do not have access to this model/i.test(message) ||
    /does not have access to this model/i.test(message)
  ) {
    return "This AI Gateway account cannot use the requested model. Blog assist now uses openai/gpt-4o-mini with google/gemini-2.5-flash-lite and anthropic/claude-3-haiku as fallbacks.";
  }

  if (name === "NoObjectGeneratedError" || /NoObjectGenerated/i.test(message)) {
    return "The model returned an incomplete outline. Try again, or switch keyword/post type.";
  }

  if (/model.*(not found|does not exist|unavailable)/i.test(message)) {
    return "The configured AI model is unavailable on AI Gateway. Check MODELS in lib/ai/gateway.ts.";
  }

  const cleaned = message.replace(/\u001b\[[0-9;]*m/g, "").trim();
  if (cleaned && cleaned.length < 220) return cleaned;
  return "AI request failed. Check Vercel function logs for [blog-assist] / [AI Gateway].";
}
