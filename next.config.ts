import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The submission guidelines ask for only the files the project needs, so the
  // generated agent-instruction files are turned off.
  agentRules: false,
};

export default nextConfig;
