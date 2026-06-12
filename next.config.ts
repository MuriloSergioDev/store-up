import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable streaming metadata to prevent server/client MetadataWrapper hydration mismatch
  htmlLimitedBots: /.*/,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'roumdccoylpyhbliktge.supabase.co',
      },
    ],
  },
};

export default nextConfig;
