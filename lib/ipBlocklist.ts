import { createAdminClient } from "@/lib/supabase/admin";

/**
 * lib/ipBlocklist.ts
 * -------------------
 * Checks a client IP against public.ip_blocklist.
 *
 * Deliberately per-IP, not per-country or per-ASN. 103.78.46.30 was used for
 * three signups with fabricated or mismatched trades and a generic
 * "Melbourne" suburb (see the migration for the full history). A country
 * block was considered and rejected: Australian trade businesses
 * legitimately use offshore bookkeepers and VAs, and blocking a whole
 * country silently locks out real people with no visible reason why. This
 * blocks confirmed-bad addresses precisely instead.
 *
 * Not middleware. Middleware runs on every request including static assets,
 * and a database round trip there would add latency to the entire site for
 * a check that only two routes need. Called explicitly from signup-adjacent
 * routes instead.
 */
export async function isIpBlocked(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ip_blocklist")
    .select("ip_address")
    .eq("ip_address", ip)
    .maybeSingle();
  if (error) {
    // Fail open. A lookup failure blocking real signups is worse than an
    // already-known-bad IP getting through occasionally - this list is a
    // targeted response to specific abuse, not the primary defence.
    console.error("[ipBlocklist] lookup failed:", error.message);
    return false;
  }
  return data !== null;
}
