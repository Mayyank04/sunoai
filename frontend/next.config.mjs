/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Keep a build from replacing chunks being served by next dev.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://127.0.0.1:8000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
