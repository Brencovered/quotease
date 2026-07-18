/**
 * lib/safeParseApiResponse.ts
 * ---------------------------
 * Every AI analysis call (drawing/voice) across all five trade builders did
 * `const body = await res.json()` unconditionally. If the response isn't
 * JSON -- most commonly a plain-text 413 "Request Entity Too Large" from
 * the platform when an uploaded photo/PDF is too large, returned before our
 * own route handler even runs -- res.json() throws a raw
 * "Unexpected token 'R', "Request En"... is not valid JSON" SyntaxError,
 * which then surfaces to the tradie as that exact confusing text instead of
 * a useful message.
 *
 * This reads the body as text first, tries to parse it, and falls back to
 * a clear message keyed off the HTTP status when it isn't valid JSON.
 */
export async function safeParseApiResponse(res: Response): Promise<{
  ok: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  parseError: string | null;
}> {
  const text = await res.text();
  try {
    const body = text ? JSON.parse(text) : {};
    return { ok: res.ok, body, parseError: null };
  } catch {
    const parseError =
      res.status === 413
        ? "That file is too large to analyse. Try a smaller photo (or fewer PDF pages) and try again."
        : `Something went wrong on our end (status ${res.status}). Please try again.`;
    return { ok: false, body: {}, parseError };
  }
}
