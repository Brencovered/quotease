"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";

/**
 * components/PostHogProvider.tsx
 * --------------------------------
 * PostHog client-side setup for the App Router.
 *
 * The one thing every App Router PostHog guide has to call out explicitly,
 * because it is easy to miss: Pages Router fired a `routeChangeComplete`
 * event PostHog could hook into automatically. App Router has no
 * equivalent client-side navigation event, so `capture_pageview: false` is
 * set at init and pageviews are captured by hand in PageviewTracker below,
 * on every pathname or search-param change. Skipping this is the most
 * common way an App Router PostHog install silently only ever sees a
 * single pageview per session (the first load) and nothing after.
 *
 * Routed through /ingest (see next.config.ts rewrites) rather than posting
 * directly to PostHog's own domain. Two reasons: ad blockers and some
 * privacy extensions block requests to posthog.com and similar
 * known-analytics domains by pattern-matching the hostname, which silently
 * drops events for a meaningful share of visitors; and requests to a
 * first-party path are less likely to be treated as third-party tracking
 * at all. PostHog's own docs recommend this as the standard setup, not an
 * unusual workaround.
 *
 * Sits alongside the existing GA4 script in app/layout.tsx rather than
 * replacing it -- different tools for different jobs (GA for the
 * marketing-funnel view Brendan already has dashboards for, PostHog for
 * product-usage/session-level analysis inside the app itself).
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      // Never throw for a missing analytics key -- the app must work
      // identically whether or not PostHog is configured. This is the
      // same "fail open, log and move on" pattern as GA4's own setup.
      console.warn("[posthog] NEXT_PUBLIC_POSTHOG_KEY not set, skipping init");
      return;
    }
    posthog.init(key, {
      api_host: "/ingest",
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com", // Only affects the in-app toolbar/session-replay UI, not ingestion (that goes through /ingest above). Set NEXT_PUBLIC_POSTHOG_UI_HOST=https://eu.posthog.com if the project is on EU cloud.
      person_profiles: "identified_only", // Do not create a person profile for anonymous visitors; only for people who actually sign in. Cuts cost and matches how the account is used (a directory visitor browsing listings is not someone who needs a tracked identity).
      capture_pageview: false, // See PageviewTracker: App Router needs this captured manually.
      capture_pageleave: true,
    });
  }, []);

  return <PHProvider client={posthog}>
    <SuspendedPageviewTracker />
    {children}
  </PHProvider>;
}

/**
 * Wrapped in Suspense because useSearchParams() opts the calling component
 * out of static rendering unless it has a Suspense boundary above it --
 * without this, every single page in the app would be forced to
 * client-side render just to support this one tracking call.
 */
function SuspendedPageviewTracker() {
  return (
    <Suspense fallback={null}>
      <PageviewTracker />
    </Suspense>
  );
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();

  useEffect(() => {
    if (!pathname || !posthogClient) return;
    let url = window.origin + pathname;
    const search = searchParams.toString();
    if (search) url += `?${search}`;
    posthogClient.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, posthogClient]);

  return null;
}
