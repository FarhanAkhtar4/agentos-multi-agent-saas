import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages manages its own output — do NOT use "standalone"
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "z-cdn.chatglm.cn",
      },
    ],
  },
};

export default nextConfig;
