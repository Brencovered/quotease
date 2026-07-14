/**
 * middleware.ts
 * -------------
 * Edge-level authentication, subscription gating, admin protection,
 * soft-deleted account blocking, and security headers for all routes.
 *
 * What it does:
 * 1. Refreshes the Supabase session from cookies (keeps users logged in)
 * 2. Blocks soft-deleted tradies during their 30-day recovery window
 * 3. For protected page routes: checks auth, subscription, onboarding
 * 4. For admin routes: checks admin email allowlist
 * 5. For cron API routes: validates CRON_SECRET
 * 6. Adds security headers to all responses (CSP, HSTS, etc.)
 *
 * Protected routes (auth + active subscription required):
 *   /electrician/*, /settings/*, /camera/*, /team/*, /clients/*,
 *   /jobs/*, /calendar/*, /map/*, /export/*, /seo/*, /comms/*, /leads/*
 *
 * Auth-only routes (auth required, subscription not checked):
 *   /billing, /onboarding
 *
 * Admin routes (auth + admin email required):
 *   /admin/*
 *
 * Public routes (no checks):
 *   /, /login, /signup, /auth/callback, /directory/*, /get-quotes,
 *   /features, /how-it-works, /blog/*, /q/*, /[tradeSuburb],
 *   all static assets
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getActiveBusinessId } from "@/lib/team";

/* ------------------------------------------------------------------ */
/*  Route classification                                               */
/* ------------------------------------------------------------------ */

/** Routes that anyone can access without auth */
const PUBLIC_PAGE_PATHS = [
  "/",
  "/login",
  "/signup",
  "/auth/callback",
  "/directory",
  "/get-quotes",
  "/features",
  "/how-it-works",
  "/blog",
  "/q",
];

/** Routes that require authentication + active subscription */
const PROTECTED_PAGE_PREFIXES = [
  "/electrician",
  "/settings",
  "/camera",
  "/team",
  "/clients",
  "/jobs",
  "/calendar",
  "/map",
  "/export",
  "/seo",
  "/comms",
  "/leads",
];

/** Routes that require admin email */
const ADMIN_PREFIXES = ["/admin"];

/** API routes that need cron secret validation */
const CRON_API_PATH = "/api/cron/";

/* ------------------------------------------------------------------ */
/*  Security headers                                                   */
/* ------------------------------------------------------------------ */

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME-type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // HSTS (only in production)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Content Security Policy
  // NOTE: When adding new external sources, add them to the relevant directive.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://www.google-analytics.com https://www.googletagmanager.com",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com https://www.google-analytics.com https://api.stripe.com https://api.xero.com https://identity.xero.com",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "upgrade-insecure-requests",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

/* ------------------------------------------------------------------ */
/*  Admin email check                                                  */
/* ------------------------------------------------------------------ */

function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

/* ------------------------------------------------------------------ */
/*  Main middleware                                                    */
/* ------------------------------------------------------------------ */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ------------------------------------------------------------------
  // 0. Canonicalise host: redirect the production Vercel alias domains
  //    to the real custom domain -- PAGE requests only.
  // ------------------------------------------------------------------
  // These specific hostnames are the fixed production aliases Vercel
  // assigns to this project (confirmed via the project's domains list) --
  // NOT the per-deployment preview URLs (which have unique hashes/branch
  // names and must keep working unredirected for reviewing branches
  // before merge). Without this, the same content is independently
  // browsable/indexable under multiple hostnames, which muddies which
  // URL search engines and social scrapers treat as authoritative --
  // canonical tags already point at www.swiftscope.com.au, but an actual
  // redirect removes any ambiguity rather than relying on a hint.
  //
  // Deliberately excludes /api/* -- if the app is already loaded from an
  // alias domain (e.g. someone opened quotease.vercel.app directly) and
  // its client-side JS calls fetch("/api/..."), redirecting that call
  // turns it into a cross-origin request. The browser then won't carry
  // the swiftscope.com.au session cookie along, and the redirected
  // response isn't necessarily readable back to the calling page either
  // -- this broke "Send" on a quote for exactly this reason. API
  // correctness matters more here than SEO canonicalisation, and
  // robots.txt already disallows crawling /api/ anyway.
  const CANONICAL_HOST = "www.swiftscope.com.au";
  const VERCEL_ALIAS_HOSTS = new Set([
    "quotease.vercel.app",
    "quotease-brennorris360-3348s-projects.vercel.app",
    "quotease-git-main-brennorris360-3348s-projects.vercel.app",
  ]);
  const requestHost = request.headers.get("host") ?? "";
  if (!pathname.startsWith("/api/") && VERCEL_ALIAS_HOSTS.has(requestHost)) {
    const canonicalUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(canonicalUrl, 308);
  }

  // Start with a mutable response so Supabase can set refreshed cookies
  const response = NextResponse.next({ request });

  // ------------------------------------------------------------------
  // 1. Determine route type
  // ------------------------------------------------------------------
  const isApiRoute = pathname.startsWith("/api/");
  const isStaticAsset =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/site.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/browserconfig.xml" ||
    pathname === "/sitemap.xml" ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".ttf");

  // Static assets should not trigger middleware (belt and braces)
  if (isStaticAsset) {
    return response;
  }

  // Check if this is a known public page
  const isPublicPage =
    pathname === "/" ||
    PUBLIC_PAGE_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );

  // Check if this is a protected page route
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some((p) =>
    pathname.startsWith(p + "/")
  );

  // Check if this is an admin route
  const isAdminRoute = ADMIN_PREFIXES.some((p) =>
    pathname.startsWith(p + "/")
  );

  // Check if this is a billing or onboarding page (auth-only, no sub check)
  const isAuthOnlyPage = pathname === "/billing" || pathname === "/onboarding";

  // Check if this is a cron API route
  const isCronApi = pathname.startsWith(CRON_API_PATH);

  // If it's a public page, just add headers and pass through
  if (isPublicPage) {
    return addSecurityHeaders(response);
  }

  // If it's an unprotected API route, add headers and pass through
  // (API routes handle their own auth + subscription checks)
  if (isApiRoute && !isCronApi) {
    return addSecurityHeaders(response);
  }

  // If it's not a route we recognise as needing protection, add headers and pass through
  if (
    !isProtectedPage &&
    !isAdminRoute &&
    !isAuthOnlyPage &&
    !isCronApi
  ) {
    return addSecurityHeaders(response);
  }

  // ------------------------------------------------------------------
  // 2. Create Supabase client and check session
  // ------------------------------------------------------------------

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ------------------------------------------------------------------
  // 3. Cron API route: validate CRON_SECRET
  // ------------------------------------------------------------------

  if (isCronApi) {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Cron secret is valid (or no secret configured -- dev mode)
    return addSecurityHeaders(response);
  }

  // ------------------------------------------------------------------
  // 4. Authentication check (all protected pages + admin)
  // ------------------------------------------------------------------

  if (!user) {
    // Not logged in -- redirect to login with a return URL
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ------------------------------------------------------------------
  // 5. Soft-deleted account check
  // ------------------------------------------------------------------

  // Account deletion is a business-level action (see /api/account/delete
  // and /api/account/restore - both owner/admin gated). Checking only the
  // logged-in individual's own deleted_at meant that if an admin deleted
  // the business, every OTHER team member (and the owner, on their own
  // login) would sail straight past this check and keep using an account
  // that's supposed to be shut down - the deletion only "took" for
  // whichever single login happened to match the deleted profile row.
  const businessId = await getActiveBusinessId(supabase, user.id);

  const { data: profileCheck } = await supabase
    .from("profiles")
    .select("deleted_at")
    .eq("id", businessId)
    .maybeSingle();

  if (
    profileCheck?.deleted_at &&
    !pathname.startsWith("/account-deleted")
  ) {
    return NextResponse.redirect(new URL("/account-deleted", request.url));
  }

  // ------------------------------------------------------------------
  // 6. Admin route check
  // ------------------------------------------------------------------

  if (isAdminRoute) {
    if (!isAdminEmail(user.email ?? undefined)) {
      // Not an admin -- redirect to dashboard
      return NextResponse.redirect(
        new URL("/electrician/dashboard", request.url)
      );
    }
    // Admin is authorised -- add headers and continue
    return addSecurityHeaders(response);
  }

  // ------------------------------------------------------------------
  // 7. Subscription + onboarding check (protected + auth-only pages)
  // ------------------------------------------------------------------

  // Onboarding and subscription are business-level concepts. A team
  // member's own individual profile row never goes through the tradie
  // onboarding wizard and has no real subscription of its own - checking
  // it directly meant a genuinely active team member could get stuck
  // bouncing between /onboarding and /billing forever, unable to reach
  // any real page, while the business they work for was fully set up
  // and subscribed the whole time.

  // Fetch the business's profile for subscription and onboarding status
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at, comp_access, onboarded_at")
    .eq("id", businessId)
    .single();

  // Onboarding check: if not onboarded, redirect to /onboarding
  // (allow the onboarding page itself and the billing page so they can pay)
  if (
    !profile?.onboarded_at &&
    pathname !== "/onboarding" &&
    pathname !== "/billing"
  ) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Subscription check (skip for billing and onboarding pages)
  if (pathname !== "/billing" && pathname !== "/onboarding") {
    const isTrialing = profile?.subscription_status === "trialing";
    const isActive = profile?.subscription_status === "active";
    const hasCompAccess = profile?.comp_access === true;
    const trialStillValid =
      !!profile?.trial_ends_at &&
      new Date(profile.trial_ends_at) > new Date();

    const hasAccess = isActive || isTrialing || hasCompAccess || trialStillValid;

    if (!hasAccess) {
      // Subscription expired or never started -- redirect to billing
      return NextResponse.redirect(new URL("/billing", request.url));
    }
  }

  // All checks passed -- add security headers and continue
  return addSecurityHeaders(response);
}

/* ------------------------------------------------------------------ */
/*  Matcher config                                                     */
/* ------------------------------------------------------------------ */

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - Static file extensions (.ico, .svg, .png, .jpg, etc.)
     */
    "/((?!_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf|otf)$).*)",
  ],
};
