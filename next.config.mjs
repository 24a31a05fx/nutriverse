/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_EXPORT === "true";
const backendTarget = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

const nextConfig = {
  output: isStaticExport ? "export" : "standalone",
  images: {
    unoptimized: true,
  },
  trailingSlash: isStaticExport,
  async rewrites() {
    if (isStaticExport) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backendTarget}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backendTarget}/health`,
      },
      {
        source: "/ready",
        destination: `${backendTarget}/ready`,
      },
      {
        source: "/store",
        destination: "/explore",
      },
      {
        source: "/search",
        destination: "/explore",
      },
      {
        source: "/categories/:slug",
        destination: "/explore?category=:slug",
      },
      {
        source: "/nutrients/:group",
        destination: "/explore?nutrient=:group",
      },
      {
        source: "/products/:id",
        destination: "/food/:id",
      },
      {
        source: "/scan",
        destination: "/scanner",
      },
    ];
  },
};

export default nextConfig;

