import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  // Keep ZIP checkouts independent of a parent folder's package manager workspace.
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["cheerio", "undici", "playwright"],
  reactStrictMode: true,
};

export default nextConfig;
