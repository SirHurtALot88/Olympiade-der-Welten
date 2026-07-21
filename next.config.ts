import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com", "127.0.0.1", "localhost"],
  experimental: {
    proxyClientMaxBodySize: "64mb",
    workerThreads: true,
  },
  typescript: {
    tsconfigPath: "tsconfig.next.json",
  },
  // Statische Portraits/Logos aus public/ werden von Next standardmäßig mit
  // max-age=0 ausgeliefert → jeder Anzeige-Vorgang revalidiert. Diese Dateien
  // ändern sich kaum; eine Stunde frisch + Hintergrund-Revalidierung passt zur
  // Policy der dynamischen Media-Route und spart den Roundtrip-Sturm.
  async headers() {
    return [
      {
        source: "/:dir(portraits|team-logos)/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
