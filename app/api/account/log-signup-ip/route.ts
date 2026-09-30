import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, getUserAgent } from "@/lib/clientIp";

/**
 * Called once, client-side, right after a successful email/password
 * signup with an immediate session (app/signup/page.tsx) - that path
 * never redirects through app/auth/callback (which handles this
 * inline instead, for OAuth and email-confirmation signups), so
 * nothing else would ever see this request.
 *
 * Logs for the CALLER's own session only (no profileId in the body) -
 * this exists to capture forensics on account creation, not to let an
 * authenticated user attribute an IP to an arbitrary other account.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  await admin.from("signup_attempts").insert({
    profile_id: user.id,
    ip_address: getClientIp(req),
    user_agent: getUserAgent(req),
    method: "password",
  });

  return NextResponse.json({ ok: true });
}
