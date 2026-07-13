import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-lib"],
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },

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
