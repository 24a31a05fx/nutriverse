/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_EXPORT === "true";

const nextConfig = {
  output: isStaticExport ? "export" : "standalone",
  images: {
    unoptimized: true,
  },
  trailingSlash: isStaticExport,
};

export default nextConfig;
