import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  poweredByHeader: false,
  agentRules: false
};

export default nextConfig;
