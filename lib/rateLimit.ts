/**
 * Rate limiting for cost-exposed API routes.
 * ------------------------------------------
 * Stopgap: none of the 78 API routes had any rate limiting at all, and
 * several trigger direct paid AI/vision API calls per request (drawing
 * analysis, voice transcription, chat). Someone flooding these -- even
 * accidentally, e.g. a buggy retry loop on the client -- can run up a
 * real bill fast, since margin per customer is thin and per-call cost is
 * real, not free.
 *
 * This is an in-memory sliding-window limiter, not a distributed one.
 * On Vercel, each serverless instance gets its own counters, so the
 * *effective* global limit across many concurrent cold-started instances
 * is looser than the numbers below suggest under heavy concurrent abuse
 * from many IPs/sessions at once. That's a real gap versus a proper
 * Redis-backed limiter (e.g. @upstash/ratelimit) -- but it requires
 * provisioning an external Redis instance (Upstash account + env vars),
 * which needs Brendan's action, not something this can set up unilaterally.
 * This closes the "one compromised or buggy session can flood a single
 * warm instance indefinitely" gap today; upgrade to Upstash later for
 * true cross-instance enforcement without changing call sites -- only
 * this file's internals would need to change.
 *
 * Keyed by authenticated user id (not IP), since every route this is
 * applied to already requires a logged-in user -- far more meaningful
 * than IP-based limiting, which punishes shared networks and does
 * nothing against a single attacker with multiple accounts/IPs anyway.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodically sweep expired buckets so this doesn't grow unbounded
// across a long-lived serverless instance's lifetime.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller can retry, only set when allowed is false. */
  retryAfterSeconds?: number;
  remaining: number;
  limit: number;
}

/**
 * Fixed-window rate limit check. Call once per request; does not throw --
 * the caller decides what to do with `allowed: false` (return a 429).
 *
 * @param key        Unique identifier for the caller, e.g. `drawing-analysis:${userId}`.
 *                    Namespacing per-route in the key means one route's
 *                    limit doesn't consume another route's budget.
 * @param limit       Max requests allowed within the window.
 * @param windowMs    Window size in milliseconds.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, limit };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
      remaining: 0,
      limit,
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, limit };
}

/**
 * Convenience wrapper: returns a ready-to-send 429 NextResponse-shaped
 * body/init when the caller is over budget, or null when they're clear
 * to proceed. Keeps route files to a 2-line integration.
 */
export function rateLimitResponseInit(result: RateLimitResult): { body: { error: string; retryAfterSeconds: number }; init: { status: number; headers: Record<string, string> } } | null {
  if (result.allowed) return null;
  return {
    body: {
      error: "Too many requests. Please wait before trying again.",
      retryAfterSeconds: result.retryAfterSeconds ?? 60,
    },
    init: {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds ?? 60) },
    },
  };
}
