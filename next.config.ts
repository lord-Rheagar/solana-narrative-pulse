import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'agent-twitter-client',
    '@roamhq/wrtc',
    '@roamhq/wrtc-win32-x64',
  ],
};

export default nextConfig;
