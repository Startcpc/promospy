import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  serverExternalPackages: ["playwright", "z-ai-web-dev-sdk", "cheerio"],
  reactStrictMode: true,
};

export default nextConfig;
