import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: [
    '@solokit/core',
    '@solokit/registry',
    '@solokit/storage',
    '@solokit/tax-engines',
    '@solokit/tool-contract',
    '@solokit/tool-contract-export',
    '@solokit/tool-invoice',
    '@solokit/tool-invoice-pdf',
    '@solokit/ui',
  ],
};

export default config;
