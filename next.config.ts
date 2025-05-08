import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // Disable ESLint during production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript checking during production builds
    ignoreBuildErrors: true,
  },
  // Disable Lightning CSS to avoid the native module error on Render
  experimental: {
    useLightningcss: false
  }
}

export default nextConfig 