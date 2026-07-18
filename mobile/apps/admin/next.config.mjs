/** @type {import('next').NextConfig} */
const nextConfig = {
  // The shared packages ship TypeScript source; Next transpiles them.
  transpilePackages: ["@sethu/tokens", "@sethu/api-client"],
};

export default nextConfig;
