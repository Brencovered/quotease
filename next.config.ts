import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-lib"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreDuringBuilds: true },

  /* ------------------------------------------------------------------ */
  /*  Performance                                                       */
  /* ------------------------------------------------------------------ */
  compress: true,

  experimental: {
    // Caches fetch() calls automatically — reduces repeated DB hits
    dynamicIO: true,
  },

  images: {
    formats: ["image/webp", "image/avif"],
    // Keep remotePatterns empty or restrict to known domains
    remotePatterns: [],
  },

  // Reduce JS bundle by not polyfilling Node APIs in the browser
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
