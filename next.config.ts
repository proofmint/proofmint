import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ipfs.io",
      },
      {
        protocol: "https",
        hostname: "ipfs.w3s.link",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default withPWA({
  dest: "public",
  reloadOnOnline: true,
  register: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
