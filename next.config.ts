import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-lib"],
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },

  /* ------------------------------------------------------------------ */
  /*  Route migration - /electrician/* -> trade-neutral paths           */
  /* ------------------------------------------------------------------ */
  // Every business used to live under /electrician/* regardless of actual
  // trade (a plumber's quote link was https://swiftscope.com.au/electrician,
  // job links were /electrician/jobs/[id], etc). Routes are now
  // trade-neutral (/quote, /jobs/[id], /materials, ...) since the app
  // never actually branched on the URL - trade only ever decided which
  // quote builder component rendered, from data, not from the path.
  // These redirects are load-bearing, not cleanup: quote and job accept/
  // decline emails already sent to real customers, and anything a tradie
  // has bookmarked, still point at the old /electrician/* paths and need
  // to keep resolving correctly indefinitely, not just until people
  // notice things are broken.
  /* ------------------------------------------------------------------ */
  /*  PostHog reverse proxy                                             */
  /* ------------------------------------------------------------------ */
  // Routes /ingest/* on this domain through to PostHog's ingestion API,
  // so the browser never has to call posthog.com (or the US/EU regional
  // host) directly. Ad blockers and privacy extensions commonly block
  // known analytics domains by hostname pattern-matching, which silently
  // drops events for a real share of visitors; a first-party path is far
  // less likely to be treated as third-party tracking. This is PostHog's
  // own documented recommendation, not a workaround specific to this app.
  //
  // skipTrailingSlashRedirect required: without it, Next's own trailing-
  // slash handling can intercept /ingest/decide (no trailing slash in
  // PostHog's own requests) before this rewrite ever sees it.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    // PostHog has separate US and EU cloud regions with different
    // ingestion hosts -- which one applies depends entirely on which
    // region was picked when the account was created (shown in the
    // project's Settings > Project in the PostHog dashboard). Defaults to
    // US since that is PostHog's default for new signups, but this must
    // be set correctly via env var for an EU-region project or every
    // event silently fails to ingest.
    const region = process.env.POSTHOG_REGION === "eu" ? "eu" : "us";
    const apiHost = `https://${region}.i.posthog.com`;
    const assetHost = `https://${region}-assets.i.posthog.com`;
    return [
      { source: "/ingest/static/:path*", destination: `${assetHost}/static/:path*` },
      { source: "/ingest/:path*", destination: `${apiHost}/:path*` },
    ];
  },

  async redirects() {
    return [
      { source: "/electrician", destination: "/quote", permanent: true },
      { source: "/electrician/:path+", destination: "/:path+", permanent: true },
    ];
  },

  /* ------------------------------------------------------------------ */
  /*  Performance                                                       */
  /* ------------------------------------------------------------------ */
  compress: true,

  images: {
    // Order is a preference list: Next serves the first format the browser
    // accepts. AVIF is meaningfully smaller than WebP for photographic
    // content like the hero, so it should be tried first. Encoding is a bit
    // slower, but that cost is paid once per source image on Vercel and
    // cached, while the byte saving is paid on every mobile visit.
    formats: ["image/avif", "image/webp"],
    // Default deviceSizes includes 3840, and next/image uses the largest
    // entry as the img src fallback. That makes the document load event
    // wait on a cold optimisation of a multi-megabyte source. 2048 covers
    // the hero's sizes cap (1280px) at 1.5x and typical 2x screens.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "ltmxsmoyaoennqksxyqt.supabase.co" },
    ],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
