import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Fase 2 opted out of AGENTS.md/CLAUDE.md at project init (create-next-app
  // --no-agents-md); `next dev` regenerates them anyway unless this is set.
  agentRules: false,
};

export default nextConfig;
