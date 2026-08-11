import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kpwucuwnbkpeqwulqqfs.supabase.co",
        pathname: "/storage/v1/object/public/vendor-products/**",
      },
    ],
  },
};

export default nextConfig;
