import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * A Supabase client for reading PUBLIC data from server components that are
 * statically prerendered.
 *
 * Why this exists, and why lib/supabase/server.ts cannot be used instead:
 *
 * `createClient()` in server.ts reads `cookies()` to resolve the signed-in
 * user's session. Touching `cookies()` opts the calling route out of static
 * rendering, and during `next build` it throws DYNAMIC_SERVER_USAGE rather
 * than returning a client. Any route with `generateStaticParams` or a
 * `revalidate` export that called it was therefore rendering its Supabase
 * query as a thrown exception at build time -- and if that throw was caught
 * and treated as "no rows", the page would prerender as though the database
 * were empty. That is a silent data-loss bug, not a logging nuisance: the
 * page ships to users and to Googlebot with nothing on it.
 *
 * This client never touches cookies, so it is safe in a prerender. It uses
 * the anon key, so Row Level Security still applies exactly as it does for
 * a logged-out visitor -- which is the correct authorisation model for a
 * public page. Use `createAdminClient()` only where RLS genuinely needs to
 * be bypassed; it is not a substitute for this.
 *
 * Correct for: public marketing, directory and SEO pages.
 * Wrong for: anything that depends on who is signed in. Those routes need
 * the cookie-aware client and must be dynamic.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // No session to persist or refresh in a server render, and doing so
    // would reintroduce exactly the statefulness this client exists to avoid.
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
