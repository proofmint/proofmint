import type { NextConfig } from "next";
import { PINATA_GATEWAY } from "./lib/const";

const extractHostname = (url: string) => {
  const urlObj = new URL(url);
  return urlObj.hostname;
};

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: extractHostname(PINATA_GATEWAY),
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
