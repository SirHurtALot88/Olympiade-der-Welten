import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com"],
  experimental: {
    cpus: 1,
    workerThreads: true,
  },
  typescript: {
    tsconfigPath: "tsconfig.next.json",
  },
};

export default nextConfig;
