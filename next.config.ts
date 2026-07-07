import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-lib"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  /* ------------------------------------------------------------------ */
  /*  Performance                                                       */
  /* ------------------------------------------------------------------ */
  compress: true,

  images: {
    formats: ["image/webp", "image/avif"],
    remotePatterns: [],
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
