/** @type {import('next').NextConfig} */
const nextConfig = {
  // The shared token package ships TypeScript source; Next transpiles it.
  transpilePackages: ["@sethu/tokens"],
};

export default nextConfig;
