import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Only ever import this in trusted server contexts (webhooks, cron jobs) —
// never in anything reachable from the browser. The service role key
// bypasses Row Level Security entirely.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
