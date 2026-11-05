import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["playwright", "z-ai-web-dev-sdk", "cheerio"],
  reactStrictMode: true,
};

export default nextConfig;
