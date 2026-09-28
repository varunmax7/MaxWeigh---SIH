import { loadRootEnv } from '@tula/config';
import type { NextConfig } from 'next';

// One .env at the repository root configures every process (see @tula/config).
loadRootEnv();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript sources during development; Next compiles them.
  transpilePackages: [
    '@tula/engine',
    '@tula/rulepacks',
    '@tula/schemas',
    '@tula/report',
    '@tula/db',
    '@tula/config',
  ],
  // On-prem first: no remote image hosts, no CDN fallbacks (implementation.md §3.2).
  images: { remotePatterns: [] },
  poweredByHeader: false,
  typedRoutes: true,
  // The repo already carries its own root-level AGENTS.md/CLAUDE.md (implementation.md
  // §11); a second, per-package pair regenerated on every `next dev` is unnecessary noise.
  agentRules: false,
};

export default nextConfig;
