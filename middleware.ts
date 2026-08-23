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
 *   /dashboard/*, /quote/*, /quotes/*, /materials/*, /schedule/*,
 *   /margins/*, /packages/*, /reports/*, /plans/*, /settings/*,
 *   /camera/*, /team/*, /clients/*,
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
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
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
  // Invitees set a password here before they have a session - must stay
  // public. Also excluded from PROTECTED_PAGE_PREFIXES below because /team
  // itself is authenticated.
  "/team/accept",
];

/** Routes that require authentication + active subscription */
const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/quote",
  "/quotes",
  "/materials",
  "/schedule",
  "/margins",
  "/packages",
  "/reports",
  "/plans",
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
  "/today",
  "/crew",
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
  // Google Analytics 4 + gtag hit regional collect hosts, GTM, and (unless
  // ads signals are off) DoubleClick pixels. Vercel Analytics / Speed Insights
  // load from va.vercel-scripts.com and report to vitals.vercel-insights.com.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://*.googletagmanager.com https://va.vercel-scripts.com https://*.posthog.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://www.google.com https://www.google.com.au https://stats.g.doubleclick.net",
    "font-src 'self'",
    // worker-src did not exist as its own directive before, so it fell back
    // to default-src 'self', which blocks the web worker PostHog's session
    // replay recorder runs in. PostHog's own CSP docs call this out
    // explicitly: https://posthog.com/docs/libraries/js.
    "worker-src 'self' blob: data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://www.google.com https://www.googletagmanager.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://api.stripe.com https://*.stripe.com https://js.stripe.com https://api.xero.com https://identity.xero.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.vercel-insights.com https://*.posthog.com",
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
/*  IP blocklist, checked on every request                             */
/* ------------------------------------------------------------------ */

// Why this exists here, not only in the two app routes that already call
// lib/ipBlocklist.ts: distinctplumbing4@gmail.com signed up via Google
// OAuth and ended up with a fully populated profile (business_name
// "plumber", trade, suburb, a 7-day trial) despite 103.78.46.30 being
// blocked. Root cause: OAuth account creation happens on Supabase's own
// infrastructure, and handle_new_user() - a Postgres trigger - fires
// synchronously on that insert and populates the profile directly from
// signup metadata. None of that ever touches my application code, so the
// checks in app/api/directory/claim and app/api/onboarding/welcome never
// got a chance to run; those routes protect specific actions, not account
// creation itself, which Supabase's own infra handles before my app is
// involved at all.
//
// What IS reachable: every request that lands back on swiftscope.com.au
// after the OAuth redirect passes through this middleware first, before
// any session is established or any page renders. Checking here cannot
// undo the auth.users row Supabase already created, but it can stop a
// blocked IP from doing anything further with it - no working session,
// no onboarding, no listing.
//
// Deliberately NOT a database round trip on every request. The comment
// in lib/ipBlocklist.ts already explains why: that would add real
// latency to every page view on the site for a list that currently holds
// one row. Cached instead - refetched at most once a minute, module
// scope, which Vercel's Edge runtime persists across invocations within
// the same isolate. Worst case, a newly blocked IP takes up to 60s to
// start being enforced here; the two route-level checks remain instant
// regardless, since they call the uncached lib/ipBlocklist.ts directly.
let blockedIpCache: { ips: Set<string>; fetchedAt: number } | null = null;
const BLOCKLIST_TTL_MS = 60_000;

async function getBlockedIps(): Promise<Set<string>> {
  if (blockedIpCache && Date.now() - blockedIpCache.fetchedAt < BLOCKLIST_TTL_MS) {
    return blockedIpCache.ips;
  }
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return blockedIpCache?.ips ?? new Set();

    const res = await fetch(`${url}/rest/v1/ip_blocklist?select=ip_address`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return blockedIpCache?.ips ?? new Set();

    const rows = (await res.json()) as { ip_address: string }[];
    blockedIpCache = { ips: new Set(rows.map((r) => r.ip_address)), fetchedAt: Date.now() };
    return blockedIpCache.ips;
  } catch {
    // Fail open on the cached value if we have one, otherwise fail open
    // entirely - same reasoning as lib/ipBlocklist.ts: a lookup failure
    // blocking real traffic sitewide is worse than a known-bad IP getting
    // through occasionally. This is a targeted response to specific
    // abuse, never the primary defence.
    return blockedIpCache?.ips ?? new Set();
  }
}

/* ------------------------------------------------------------------ */
/*  Traffic logging, for /admin/activity                               */
/* ------------------------------------------------------------------ */


// Same list as lib/adminActivity's classification, kept here too since
// middleware runs on the Edge runtime and cannot import from a route
// that pulls in the full Supabase server client. Duplicated deliberately
// rather than sharing a module with heavier dependencies.
const BOT_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /googlebot-image/i, label: "Googlebot (images)" },
  { pattern: /googlebot/i, label: "Googlebot" },
  { pattern: /google-inspectiontool/i, label: "Google Search Console" },
  { pattern: /googleother/i, label: "GoogleOther" },
  { pattern: /bingbot/i, label: "Bingbot" },
  { pattern: /duckduckbot/i, label: "DuckDuckBot" },
  { pattern: /ahrefsbot/i, label: "AhrefsBot" },
  { pattern: /semrushbot/i, label: "SemrushBot" },
  { pattern: /facebookexternalhit/i, label: "Facebook link preview" },
  { pattern: /slackbot/i, label: "Slack link preview" },
  { pattern: /vercel-screenshot/i, label: "Vercel (internal)" },
];

/**
 * Fire-and-forget insert into public.traffic_log via the REST API
 * directly (plain fetch, no supabase-js client) - this file runs on the
 * Edge runtime, and a full client import here is unnecessary weight for
 * one insert. Never awaited by the caller and never throws: a failure
 * here must never be able to affect the response middleware returns.
 */
function logTraffic(request: NextRequest, pathname: string, event: NextFetchEvent) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return; // never block a request for a missing log config

    const userAgent = request.headers.get("user-agent");
    const bot = userAgent ? BOT_PATTERNS.find((b) => b.pattern.test(userAgent)) : undefined;

    // Real client IP, left-most x-forwarded-for entry - see lib/clientIp.ts
    // for why the left-most (not last) entry is the one that is actually
    // the visitor rather than a Vercel edge hop.
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;

    const body = JSON.stringify({
      path: pathname,
      method: request.method,
      ip_address: ip,
      user_agent: userAgent,
      is_bot: !!bot,
      bot_label: bot?.label ?? null,
    });

    const promise = fetch(`${url}/rest/v1/traffic_log`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body,
    }).catch(() => {
      // Logging is best-effort. A dropped row here is a gap in the
      // activity feed, never a broken page for a real visitor.
    });

    // NextFetchEvent.waitUntil keeps this fetch alive past the point
    // middleware returns its response, which is required on the Edge
    // runtime - without it, the function can tear down and cancel the
    // in-flight insert before it completes, silently dropping the row.
    event.waitUntil(promise);
  } catch {
    // Never let a logging bug affect the request it was trying to log.
  }
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // ------------------------------------------------------------------
  // -1. Traffic log, for the real-time admin activity view. Deliberately
  //     the very first thing in this function, before any redirect or
  //     auth branch, so every request middleware sees is captured
  //     regardless of which path it takes afterward - a 308 canonical
  //     redirect, an admin 403, a normal page load, all logged the same.
  //
  //     Excludes /admin/* and /api/admin/* entirely. Two real bugs found
  //     by checking the actual numbers after a "why do I have so much
  //     traffic" question: the admin activity page itself polls
  //     /api/admin/activity every 4 seconds, and that self-polling was
  //     counted as public site traffic - 687 of a reported 2,698
  //     "human" hits in 24h, from 4 IPs, was the dashboard watching
  //     itself. The rest of /admin/* (directory, tradies, outreach, seo,
  //     scraper, roadmap, emails - everywhere the actual admin was
  //     browsing) added another ~130 hits from 3 IPs on top of that.
  //     Neither is a visitor. Excluding both at the source, not filtering
  //     them out at display time, since counting them at all was the bug.
  //
  //     Fire-and-forget: logTraffic() never throws and is never awaited
  //     inline, so a Supabase hiccup or a slow insert can never delay or
  //     break the actual response. request.body is not read here, so
  //     this cannot interfere with anything downstream reading it.
  // ------------------------------------------------------------------
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    logTraffic(request, pathname, event);
  }

  // ------------------------------------------------------------------
  // -0.5. IP blocklist. After logging (a blocked attempt is itself worth
  //       having in the activity feed) but before every other branch -
  //       host canonicalisation, auth, admin checks all come after this,
  //       so a blocked IP is refused before any of that logic runs, not
  //       just before the routes that used to be the only enforcement
  //       point. See the "IP blocklist, checked on every request"
  //       comment block above for why this exists in middleware at all.
  // ------------------------------------------------------------------
  {
    const xff = request.headers.get("x-forwarded-for");
    const realIp = xff?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
    if (realIp) {
      const blocked = await getBlockedIps();
      if (blocked.has(realIp)) {
        // 404, not 403. A 403 confirms "you have been specifically
        // detected and blocked," which is exactly the signal that tells
        // someone to switch IPs immediately. A 404 looks like the route
        // does not exist and gives away nothing about why.
        return new NextResponse("Not found", { status: 404 });
      }
    }
  }

  // ------------------------------------------------------------------
  // 0. Canonicalise host: redirect every non-canonical production host
  //    (Vercel's own aliases, plus www) to the real canonical domain -
  //    PAGE requests only.
  // ------------------------------------------------------------------
  // Canonical host is the bare apex (swiftscope.com.au), not www -
  // matches every claim link, email template, and external reference
  // already in use elsewhere in this app. There's no SEO difference
  // between www/non-www once one is picked and enforced; what matters is
  // picking one and actually redirecting the other, which this didn't do
  // for www itself until now. Confirmed via Search Console: both
  // https://swiftscope.com.au/sitemap.xml and
  // https://www.swiftscope.com.au/sitemap.xml were independently
  // submitted and successfully crawled (1,722 pages each) with no
  // redirect between the two hosts - Google was indexing the same
  // content under two separate hostnames, which is exactly what produces
  // "Duplicate without user-selected canonical" in Search Console.
  //
  // These specific hostnames are the fixed production aliases Vercel
  // assigns to this project (confirmed via the project's domains list) -
  // NOT the per-deployment preview URLs (which have unique hashes/branch
  // names and must keep working unredirected for reviewing branches
  // before merge).
  //
  // Deliberately excludes /api/* - if the app is already loaded from a
  // non-canonical host (e.g. someone opened www.swiftscope.com.au or
  // quotease.vercel.app directly) and its client-side JS calls
  // fetch("/api/..."), redirecting that call turns it into a
  // cross-origin request. The browser then won't carry the
  // swiftscope.com.au session cookie along, and the redirected response
  // isn't necessarily readable back to the calling page either - this
  // broke "Send" on a quote for exactly this reason. API correctness
  // matters more here than SEO canonicalisation, and robots.txt already
  // disallows crawling /api/ anyway.
  const CANONICAL_HOST = "swiftscope.com.au";
  const NON_CANONICAL_HOSTS = new Set([
    "www.swiftscope.com.au",
    "quotease.vercel.app",
    "quotease-brennorris360-3348s-projects.vercel.app",
    "quotease-git-main-brennorris360-3348s-projects.vercel.app",
  ]);
  const requestHost = request.headers.get("host") ?? "";
  if (!pathname.startsWith("/api/") && NON_CANONICAL_HOSTS.has(requestHost)) {
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
  //
  // BUG FIX: previously only matched pathname.startsWith(p + "/"), which
  // requires a trailing sub-path segment. The bare path itself (e.g.
  // exactly "/dashboard", with nothing after it) never matched, since
  // "/dashboard".startsWith("/dashboard/") is false - meaning the single
  // most-visited URL for every one of these routes fell all the way
  // through to the "not a route we recognise as needing protection"
  // branch below and skipped auth, subscription, AND onboarding checks
  // entirely. This is why a freshly signed-up, non-onboarded account
  // could land on /dashboard directly: /quote happened to still redirect
  // to /onboarding because that page has its own separate onboarded_at
  // check, but /dashboard has no such page-level check and was relying
  // entirely on this now-fixed middleware gate.
  const isProtectedPage =
    !pathname.startsWith("/team/accept/") &&
    PROTECTED_PAGE_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );

  // Check if this is an admin route (same bare-path fix as isProtectedPage above)
  const isAdminRoute = ADMIN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
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
    // Cron secret is valid (or no secret configured - dev mode)
    return addSecurityHeaders(response);
  }

  // ------------------------------------------------------------------
  // 4. Authentication check (all protected pages + admin)
  // ------------------------------------------------------------------

  if (!user) {
    // Not logged in - redirect to login with a return URL
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
      // Not an admin - redirect to dashboard
      return NextResponse.redirect(
        new URL("/dashboard", request.url)
      );
    }
    // Admin is authorised - add headers and continue
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
    .select("subscription_status, trial_ends_at, comp_access, onboarded_at, trades")
    .eq("id", businessId)
    .single();

  // Site members (basic access) only need My day / their jobs - bounce them
  // off owner tooling so they never land on an empty dashboard.
  const { data: membershipRow } = await supabase
    .from("team_members")
    .select("role")
    .eq("member_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  const isFieldWorker =
    membershipRow?.role === "site_member" || membershipRow?.role === "member";

  const FIELD_WORKER_HOME = "/today";
  const FIELD_WORKER_BLOCKED_PREFIXES = [
    "/dashboard",
    "/quote",
    "/quotes",
    "/materials",
    "/margins",
    "/packages",
    "/reports",
    "/plans",
    "/clients",
    "/team",
    "/crew",
    "/leads",
    "/export",
    "/map",
    "/comms",
    "/seo",
    "/camera",
  ];
  if (
    isFieldWorker &&
    FIELD_WORKER_BLOCKED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    )
  ) {
    return NextResponse.redirect(new URL(FIELD_WORKER_HOME, request.url));
  }

  // Trade selection is mandatory - quoting is trade-specific, so an
  // account with no trade set can't meaningfully use the app at all.
  // Client-side signup validation exists but isn't airtight on its own
  // (confirmed: real accounts have ended up with an empty trades array
  // despite that) - this is the actual, unbypassable guarantee, checked
  // on every protected page regardless of onboarded_at, since an account
  // could in principle be marked onboarded with no trade ever having
  // been set. Redirects to /onboarding, which shows a mandatory trade
  // picker first when it detects this.
  // Field workers inherit the owner's trade book via team membership -
  // never send them through owner onboarding for an empty personal profile.
  const hasNoTrade = !profile?.trades || profile.trades.length === 0;
  if (
    !isFieldWorker &&
    hasNoTrade &&
    pathname !== "/onboarding" &&
    pathname !== "/billing"
  ) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Onboarding check: if not onboarded, redirect to /onboarding
  // (allow the onboarding page itself and the billing page so they can pay)
  if (
    !isFieldWorker &&
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
      // Subscription expired or never started - redirect to billing
      return NextResponse.redirect(new URL("/billing", request.url));
    }
  }

  // All checks passed - add security headers and continue
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
