import path from "node:path";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    // `apps/*` sind eigenstaendige Apps mit eigenem package.json, eigenem Prisma-Schema und eigener
    // vitest.config.ts (z. B. apps/LEC). Ohne diesen Ausschluss sammelt die Root-Suite deren Tests
    // mit ein und faehrt sie unter der FALSCHEN Konfiguration: `@` zeigt auf das Repo-Root statt auf
    // die App-`src`, und `@prisma/client` loest auf den generierten Root-Client (postgresql) auf
    // statt auf den der App (sqlite) -- die Tests scheiterten dadurch reproduzierbar an
    // "the URL must start with the protocol `postgresql://`", obwohl an ihnen selbst nichts kaputt
    // ist. Jede App faehrt ihre Tests ueber ihr eigenes `npm test`.
    exclude: [...configDefaults.exclude, "apps/**"],
  },
});
