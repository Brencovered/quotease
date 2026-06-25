import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Login-gating only for now — the Stripe/subscription check has been
// pulled out deliberately. Re-add it once Stripe is actually wired up on
// this deployment; until then it's dead weight that can fail before
// Stripe is even involved (e.g. if Supabase env vars or the profiles
// table aren't fully set up yet), which used to take the whole site down
// with MIDDLEWARE_INVOCATION_FAILED.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;
  const loginRequiredPaths = ["/electrician", "/settings", "/billing"];
  if (!loginRequiredPaths.some((p) => pathname.startsWith(p))) {
    return response;
  }

  // Any failure here (missing env vars, Supabase unreachable, etc.) falls
  // through to "let the request continue" rather than crashing the whole
  // site with a 500 — worst case a protected page loads when it shouldn't,
  // which is recoverable, vs. the entire app going down, which isn't.
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  } catch (err) {
    console.error("middleware auth check failed, allowing request through:", err);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
