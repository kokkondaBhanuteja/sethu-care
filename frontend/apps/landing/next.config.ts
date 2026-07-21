import type { NextConfig } from "next";

// Static export: the landing page is a pure marketing artifact — prerendered HTML for SEO,
// deployable to any static host/CDN. No server runtime.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
