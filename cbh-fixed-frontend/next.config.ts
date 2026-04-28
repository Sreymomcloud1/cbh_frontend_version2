import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },

  // ✅ ADD THIS
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;