import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    BACKEND_URL:
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.BACKEND_URL ||
      "http://localhost:5001",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
  async rewrites() {
    const target =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.BACKEND_URL ||
      "http://localhost:5001";
    return [
      {
        source: "/uploads/:path*",
        destination: `${target}/uploads/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${target}/api/:path*`,
      },
      {
        source: "/admin/:path*",
        destination: `${target}/admin/:path*`,
      },
      {
        source: "/comment/:path*",
        destination: `${target}/comment/:path*`,
      },
      {
        source: "/comments/:path*",
        destination: `${target}/comments/:path*`,
      },
      {
        source: "/video/:path*",
        destination: `${target}/video/:path*`,
      },
      {
        source: "/videos/:path*",
        destination: `${target}/videos/:path*`,
      },
      {
        source: "/user/:path*",
        destination: `${target}/user/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${target}/auth/:path*`,
      },
      {
        source: "/meeting/:path*",
        destination: `${target}/meeting/:path*`,
      },
      {
        source: "/like/:path*",
        destination: `${target}/like/:path*`,
      },
      {
        source: "/watchlater/:path*",
        destination: `${target}/watchlater/:path*`,
      },
    ];
  },
};

export default nextConfig;
