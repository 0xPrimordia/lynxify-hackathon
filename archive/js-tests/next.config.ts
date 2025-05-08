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
  env: {
    NEXT_PUBLIC_OPERATOR_ID: process.env.NEXT_PUBLIC_OPERATOR_ID,
    OPERATOR_KEY: process.env.OPERATOR_KEY,
    NEXT_PUBLIC_GOVERNANCE_TOPIC_ID: process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID,
    NEXT_PUBLIC_AGENT_TOPIC_ID: process.env.NEXT_PUBLIC_AGENT_TOPIC_ID,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },
};

export default nextConfig;
