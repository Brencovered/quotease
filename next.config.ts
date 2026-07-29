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
  async redirects() {
    return [
      { source: "/electrician", destination: "/quote", permanent: true },
      { source: "/electrician/:path+", destination: "/:path+", permanent: true },
    ];
  },

  /* ------------------------------------------------------------------ */
  /*  Security headers - none of these were set explicitly before; only */
  /*  whatever defaults Vercel's edge applies on its own.                */
  /* ------------------------------------------------------------------ */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Never let the app be framed by another site (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // Stop browsers guessing content-types away from what's declared.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak the full referring URL (which can contain tokens in
          // query strings, e.g. docket sign links, quote response links)
          // to third-party destinations.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Force HTTPS for a year, including subdomains, and allow this
          // domain to be added to browsers' HSTS preload lists.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Disable browser features this app never uses, so a compromised
          // dependency/XSS can't silently request them.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=()" },
        ],
      },
    ];
  },

  /* ------------------------------------------------------------------ */
  /*  Performance                                                       */
  /* ------------------------------------------------------------------ */
  compress: true,

  images: {
    formats: ["image/webp", "image/avif"],
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
