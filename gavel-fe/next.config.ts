import type { NextConfig } from "next";

const API_URL = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api');
const API_ORIGIN = API_URL.origin;

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      {
        protocol: API_URL.protocol === "https:" ? "https" : "http",
        hostname: API_URL.hostname,
        port: API_URL.port,
        pathname: "/uploads/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: `${API_ORIGIN}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
