/**
 * lib/ai/userFacingError.ts
 * -------------------------
 * Turns an AI provider or gateway failure into something safe to show a
 * tradie, and logs the real thing server-side.
 *
 * Why this exists. The AI routes returned `err.message` verbatim, and the
 * chat UI renders the error field as the assistant's reply. When the Vercel
 * AI Gateway rejected a model, a paying customer's Business assistant
 * answered their question with:
 *
 *   "Free tier users do not have access to this model. Upgrade to paid
 *    credits at https://vercel.com/d?to=%2F%5Bteam%5D... for unrestricted
 *    access."
 *
 * That is our billing state, our infrastructure vendor and a link to our own
 * account dashboard, presented to a customer as product output. Beyond the
 * embarrassment it tells anyone who sees it exactly what stack sits behind
 * the feature and that it is on a free plan.
 *
 * Provider messages are written for the developer holding the API key, never
 * for the end user, so none of them should reach a client. Map to a small set
 * of honest, plain-English outcomes instead and keep the detail in the logs
 * where it is useful.
 */

export interface UserFacingError {
  /** Safe to render directly in the UI. */
  message: string;
  /** Coarse cause, for the client to branch on if it wants to. */
  kind: "unavailable" | "rate_limited" | "too_large" | "timeout" | "unknown";
  status: number;
}

export function toUserFacingError(err: unknown, context: string): UserFacingError {
  const raw = err instanceof Error ? err.message : String(err);

  // Always log the real thing. This is the only place it should appear.
  console.error(`[${context}]`, raw);

  const lower = raw.toLowerCase();

  // Account, credit, entitlement and auth problems at the provider. Nothing
  // the user did, and nothing they can act on, so do not hint at billing.
  if (
    /free tier|do not have access|insufficient|credit|quota exceeded|unauthorized|forbidden|invalid api key|402|403/.test(
      lower
    )
  ) {
    return {
      message:
        "The AI assistant is temporarily unavailable. Nothing you did, and nothing on your account. Please try again later.",
      kind: "unavailable",
      status: 503,
    };
  }

  if (/rate limit|too many requests|429/.test(lower)) {
    return {
      message: "The AI assistant is busy right now. Give it a minute and try again.",
      kind: "rate_limited",
      status: 429,
    };
  }

  if (/context length|too long|maximum.*tokens|payload too large|413/.test(lower)) {
    return {
      message: "That was too long for the assistant to read. Try a shorter message.",
      kind: "too_large",
      status: 413,
    };
  }

  if (/timeout|timed out|aborted|econnreset/.test(lower)) {
    return {
      message: "The assistant took too long to answer. Please try again.",
      kind: "timeout",
      status: 504,
    };
  }

  return {
    message: "The AI assistant hit a problem answering that. Please try again.",
    kind: "unknown",
    status: 502,
  };
}
