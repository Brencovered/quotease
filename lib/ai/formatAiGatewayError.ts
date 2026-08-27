/**
 * Map AI Gateway / AI SDK failures into short admin-facing messages.
 * The blog assist UI only shows `error` from the JSON body, so a generic
 * "Planning failed" hides whether auth, credits, or the model blew up.
 */
export function formatAiGatewayError(err: unknown): string {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name?: unknown }).name)
      : "";
  const statusCode =
    err && typeof err === "object" && "statusCode" in err
      ? Number((err as { statusCode?: unknown }).statusCode)
      : undefined;
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";

  if (
    name === "GatewayAuthenticationError" ||
    /Unauthenticated request to AI Gateway/i.test(message) ||
    /AI_GATEWAY_API_KEY/i.test(message)
  ) {
    return "AI Gateway is not authenticated. Set AI_GATEWAY_API_KEY in the Vercel project env (AI Gateway → API Keys), or confirm OIDC is enabled for this deployment.";
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
    return "This AI Gateway account cannot use the requested model. Blog assist now uses openai/gpt-4o-mini with anthropic/claude-3-haiku as fallback - the same pair drawing-analysis already uses successfully.";
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
