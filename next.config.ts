import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images:{
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ipfs.io",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
