import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  serverExternalPackages: ["cheerio"],
  reactStrictMode: true,
};

export default nextConfig;
