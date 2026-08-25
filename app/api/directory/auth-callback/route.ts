import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * app/api/directory/auth-callback/route.ts
 * ------------------------------------------
 * A second, dedicated OAuth callback, separate from app/auth/callback,
 * used only by the directory claim page's Google button.
 *
 * Why not just reuse the existing callback: it force-redirects any
 * brand-new or never-onboarded user to /onboarding, ignoring `next`
 * entirely. That is correct for the main platform's own login/signup, but
 * wrong here -- a tradie signing in with Google specifically to claim a
 * directory listing needs to land back on the claim page, not get pulled
 * into the $45 plan's onboarding wizard. That exact confusion (a real
 * account existing under a flow the person did not recognise) is what
 * this whole feature is fixing, so reusing the platform callback would
 * reintroduce the same problem from a different angle.
 *
 * Also closes a real gap while the plumbing is already here: the
 * directory-only trial skip (handle_new_user() reading
 * raw_user_meta_data.signup_source = 'directory_claim') only works for
 * email signUp(), because signInWithOAuth() has no equivalent way to
 * inject custom user_metadata -- Google controls what comes back, not the
 * client. A brand-new Google sign-in through this specific entry point
 * has therefore always fallen through and received a full 7-day platform
 * trial like a real platform signup, exactly as confirmed happened for
 * the tradie who prompted this fix (Crowncon Homes: trial_ends_at set,
 * onboarding-shaped profile data, despite never touching /onboarding on
 * purpose). Detected here by checking whether the account was created in
 * the last few seconds of this exact request -- if so, this OAuth call
 * was the actual signup, not a login to a pre-existing account, and the
 * trial is nulled the same way the email path already skips it.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const target = next && next.startsWith("/") ? next : "/directory/claim";

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    const user = data.user;

    if (user) {
      const createdMsAgo = Date.now() - new Date(user.created_at).getTime();
      // Generous window (60s) since this includes the full Google
      // redirect round trip, not just the callback's own execution time.
      const justCreated = createdMsAgo >= 0 && createdMsAgo < 60_000;

      if (justCreated) {
        const admin = createAdminClient();
        const { error } = await admin
          .from("profiles")
          .update({ trial_ends_at: null })
          .eq("id", user.id)
          .not("trial_ends_at", "is", null); // only touch it if the trigger actually set one
        if (error) {
          console.error("[directory/auth-callback] failed to clear trial for new Google signup:", error.message);
          // Not fatal to the sign-in itself -- worst case this account
          // keeps a trial it should not have, which is the same
          // pre-existing gap this route exists to close, not a new
          // failure mode. Never block the redirect over it.
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}${target}`);
}
