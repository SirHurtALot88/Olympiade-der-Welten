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
    exclude: [
      ...configDefaults.exclude,
      // `apps/*` sind eigenstaendige Apps mit eigenem package.json, eigenem Prisma-Schema und eigener
      // vitest.config.ts (z. B. apps/LEC). Ohne diesen Ausschluss sammelt die Root-Suite deren Tests
      // mit ein und faehrt sie unter der FALSCHEN Konfiguration: `@` zeigt auf das Repo-Root statt auf
      // die App-`src`, und `@prisma/client` loest auf den generierten Root-Client (postgresql) auf
      // statt auf den der App (sqlite) -- die Tests scheiterten dadurch reproduzierbar an
      // "the URL must start with the protocol `postgresql://`", obwohl an ihnen selbst nichts kaputt
      // ist. Jede App faehrt ihre Tests ueber ihr eigenes `npm test`.
      "apps/**",
      // tests/ui-cockpit-playtest.spec.js (und kuenftige "*.spec.js" in tests/) ist ein Playwright-
      // E2E-Spec (siehe playwright.config.ts), das "@playwright/test" braucht und einen echten
      // Dev-Server treibt. Es enthaelt 0 vitest-Tests, wird vom Default-Glob aber eingesammelt und
      // scheitert beim Collect ("Playwright Test did not expect test() to be called here").
      "**/tests/*.spec.js",
      // `.claude/worktrees/*` sind Scratch-Checkouts von Subagenten. Sie enthalten
      // vollstaendige Kopien von `tests/`, teils auf altem Stand. Die Root-Suite sammelt
      // sie sonst mit ein und faehrt VERALTETE Tests gegen den AKTUELLEN Quellstand --
      // die Fehlschlaege sehen aus wie echte Regressionen, gehoeren aber einem laengst
      // beendeten Agentenlauf. In der CI faellt das nicht auf (frischer Checkout), lokal
      // verfaelscht es jeden vollen Lauf.
      "**/.claude/worktrees/**",
    ],
    env: {
      // Der Online-Save-Auto-Export (lib/persistence/online-save-auto-export.ts) läuft per Default
      // (OLY_AUTO_EXPORT_SAVES=1) und spiegelt jeden erzeugten Spielstand nach `data/online-saves/` —
      // ein VERSIONIERTES Verzeichnis. Dadurch hinterließ jeder Testlauf .json.gz-Artefakte im Repo
      // (genau die Sorte, die Commit 73f1266 als "polluting fresh envs" wieder entfernen musste).
      // Tests brauchen den Export nie, also hier hart aus.
      OLY_AUTO_EXPORT_SAVES: "0",
    },
  },
});
