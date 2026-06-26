import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "pdf-lib", "qrcode"],
};

export default nextConfig;
