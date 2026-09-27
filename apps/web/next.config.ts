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
};

export default nextConfig;
