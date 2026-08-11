import type { NextRequest } from "next/server";

/**
 * lib/clientIp.ts
 * ---------------
 * Pulls the real client IP and user agent out of a request.
 *
 * Why this exists: there was no way to investigate four suspicious signups,
 * because nothing recorded where they came from. Supabase's
 * auth.audit_log_entries is pruned and came back empty, so no historical IP
 * exists for any account on this project. This is the fix for the next time.
 *
 * The header handling is the part worth getting right. Behind Vercel,
 * x-forwarded-for is a comma-separated chain, client first, then each proxy:
 *
 *     x-forwarded-for: 203.0.113.7, 172.16.0.1, 10.0.0.5
 *
 * Taking the last entry gives you Vercel's own edge address on every request,
 * which is worse than useless: it makes unrelated users look like they share
 * an IP. Take the left-most.
 *
 * Note the left-most entry is also client-supplied and therefore spoofable in
 * principle. On Vercel the platform overwrites the header at the edge, so it
 * is trustworthy here, but this is evidence for a human to weigh, never an
 * authorisation control. Do not gate access on it.
 */
export function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  // Vercel also sets this, and it is already a single address.
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export function getUserAgent(req: NextRequest): string | null {
  // Truncated: user agents can be long and the column is for identifying
  // patterns (same device across accounts), not forensic completeness.
  return req.headers.get("user-agent")?.slice(0, 400) ?? null;
}
