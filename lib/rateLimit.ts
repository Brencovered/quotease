/**
 * Rate limiting for cost-exposed API routes.
 * ------------------------------------------
 * Several routes trigger direct paid AI/vision API calls per request
 * (drawing analysis, voice transcription, chat). Someone flooding these --
 * even accidentally, e.g. a buggy retry loop on the client -- can run up
 * a real bill fast, since margin per customer is thin and per-call cost
 * is real, not free.
 *
 * Backed by Upstash Redis (sliding-window, cross-instance) when
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set. If those env
 * vars are absent -- e.g. Upstash hasn't been provisioned yet -- this
 * falls back to the original in-memory limiter so nothing breaks, but
 * enforcement is then per-instance only (a single warm Vercel instance's
 * counters, not a global limit across concurrent cold starts).
 *
 * Keyed by authenticated user id (not IP), since every route this is
 * applied to already requires a logged-in user -- far more meaningful
 * than IP-based limiting, which punishes shared networks and does
 * nothing against a single attacker with multiple accounts/IPs anyway.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller can retry, only set when allowed is false. */
  retryAfterSeconds?: number;
  remaining: number;
  limit: number;
}

// ── Upstash-backed path ─────────────────────────────────────────────────────

const upstashConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = upstashConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Ratelimit instances are keyed by their (limit, windowMs) shape and cached,
// since a new sliding-window limiter must be constructed per distinct
// limit/window combination but call sites reuse the same few combinations
// on every request.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  const existing = limiterCache.get(cacheKey);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis: redis!,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    analytics: false,
    prefix: "quotease-ratelimit",
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

async function checkRateLimitUpstash(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const limiter = getLimiter(limit, windowMs);
  const result = await limiter.limit(key);
  return {
    allowed: result.success,
    remaining: result.remaining,
    limit: result.limit,
    retryAfterSeconds: result.success
      ? undefined
      : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
  };
}

// ── In-memory fallback path (used only when Upstash isn't configured) ──────

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function checkRateLimitInMemory(key: string, limit: number, windowMs: number): RateLimitResult {
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

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Rate limit check. Call once per request; does not throw -- the caller
 * decides what to do with `allowed: false` (return a 429).
 *
 * Uses Upstash Redis when configured (true cross-instance enforcement),
 * otherwise falls back to an in-memory per-instance limiter.
 *
 * @param key        Unique identifier for the caller, e.g. `drawing-analysis:${userId}`.
 *                    Namespacing per-route in the key means one route's
 *                    limit doesn't consume another route's budget.
 * @param limit       Max requests allowed within the window.
 * @param windowMs    Window size in milliseconds.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (redis) {
    try {
      return await checkRateLimitUpstash(key, limit, windowMs);
    } catch (err) {
      // Upstash unreachable -- fail open to in-memory rather than blocking
      // every request or throwing 500s on a rate-limiter outage.
      console.error("Upstash rate limit check failed, falling back to in-memory:", err);
      return checkRateLimitInMemory(key, limit, windowMs);
    }
  }
  return checkRateLimitInMemory(key, limit, windowMs);
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
