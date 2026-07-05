/**
 * middleware.ts
 * -------------
 * Only job right now: stop a soft-deleted tradie from using the app
 * during their 30-day recovery window. Everything else (marketing pages,
 * /admin, /api, /q public quote links) is untouched -- see `matcher`
 * below, this only runs on the authenticated app routes.
 *
 * If the logged-in user's profile has deleted_at set, redirect to
 * /account-deleted (a page offering to restore, separate from this file)
 * instead of the page they asked for.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("deleted_at")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profile?.deleted_at && !request.nextUrl.pathname.startsWith("/account-deleted")) {
    return NextResponse.redirect(new URL("/account-deleted", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/electrician/:path*",
    "/settings/:path*",
    "/billing/:path*",
    "/team/:path*",
    "/onboarding/:path*",
    "/camera/:path*",
    "/account-deleted",
  ],
};
