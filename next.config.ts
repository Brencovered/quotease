import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-lib", "qrcode", "jimp"],
};

export default nextConfig;
