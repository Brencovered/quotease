import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

export async function GET(request: Request) {
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
      // belong to, not their own id -- same fix already applied to the
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
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }
    }
  }

  const target = next && next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(`${origin}${target}`);
}
