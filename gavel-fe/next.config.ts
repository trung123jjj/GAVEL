import type { NextConfig } from "next";

const API_URL = new URL(
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  'http://localhost:3000',
);
const API_ORIGIN = API_URL.origin;
const BACKEND_URL = new URL(process.env.BACKEND_ORIGIN || API_ORIGIN);
const BACKEND_ORIGIN = BACKEND_URL.origin;

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
      {
        protocol: BACKEND_URL.protocol === "https:" ? "https" : "http",
        hostname: BACKEND_URL.hostname,
        port: BACKEND_URL.port,
        pathname: "/uploads/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${BACKEND_ORIGIN}/uploads/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${BACKEND_ORIGIN}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
