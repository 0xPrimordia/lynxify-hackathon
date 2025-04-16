import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      'mainnet-public.mirrornode.hedera.com',
      'testnet.mirrornode.hedera.com',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.mirrornode.hedera.com',
        pathname: '/api/v1/tokens/*/logo',
      },
    ],
  },
};

export default nextConfig;
