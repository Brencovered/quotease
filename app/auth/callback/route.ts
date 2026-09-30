import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBusinessId } from "@/lib/team";
import { getClientIp, getUserAgent } from "@/lib/clientIp";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // A team member's own row never gets onboarded_at set (only the
      // business owner's does), so this has to check the business they
      // belong to, not their own id - same fix already applied to the
      // password-login flow, which had the identical gap.
      const businessId = await getActiveBusinessId(supabase, user.id);
      const isTeamMember = businessId !== user.id;
      if (!isTeamMember) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarded_at")
          .eq("id", businessId)
          .maybeSingle();
        if (!profile?.onboarded_at) {
          // Covers Google OAuth and email-confirmation signups - the
          // other two paths (password signup on /signup and on
          // /directory/claim, both with an immediate session) never
          // redirect through here at all, so they log this same thing
          // client-side instead via /api/account/log-signup-ip. Fires
          // on every unonboarded visit here, not strictly only the
          // very first - harmless, it just adds signal rather than
          // creating a false one.
          const admin = createAdminClient();
          await admin.from("signup_attempts").insert({
            profile_id: user.id,
            ip_address: getClientIp(request),
            user_agent: getUserAgent(request),
            method: "oauth",
          });
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }
    }
  }

  const target = next && next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(`${origin}${target}`);
}
