import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.COOOK_DIST_DIR || ".next",
  // Pin the workspace root so a lockfile further up the tree is ignored.
  turbopack: { root: __dirname },
  // The dev overlay button sits exactly on top of the mobile tab bar.
  devIndicators: false,
  images: {
    // Thumbnails come straight from the social platform CDNs.
    remotePatterns: [
      { protocol: "https", hostname: "**.tiktokcdn.com" },
      { protocol: "https", hostname: "**.tiktokcdn-us.com" },
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
};

export default nextConfig;
