import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // apps/LEC ist eine eigenstaendige App im Oly-Monorepo mit eigenem
  // package-lock.json -- ohne diese Angabe waehlt Next.js faelschlich den
  // Repo-Root (wegen des zweiten Lockfiles dort) als Workspace-Root.
  outputFileTracingRoot: __dirname,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Die App ist bewusst "unlisted" (eigene Subdomain ohne Verlinkung von der
  // Oly, siehe KONZEPT §4.2) -- zusaetzlich zu public/robots.txt und der
  // Middleware setzt das hier fuer ALLE Routen (auch statische Assets) den
  // Header, damit die URL nicht versehentlich indexiert wird.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
