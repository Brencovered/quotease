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
