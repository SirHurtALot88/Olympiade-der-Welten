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
    // Laeuft einmal JE TESTDATEI und gibt jeder ihre eigene SQLite-Datei. Ohne das teilen sich
    // alle Testdateien eines Workers eine Datenbank auf der Platte — gemessen: eine einzige
    // zusaetzliche LEERE Testdatei faerbte zwei unbeteiligte Dateien rot, weil sich dadurch die
    // Verteilung auf die Worker verschob. Begruendung im Detail in der Setup-Datei.
    /**
     * 5 s (vitest-Default) ist fuer diese Suite die falsche Grenze.
     *
     * Ein grosser Teil der Tests hier ist integrationsnah: sie bootstrappen einen kompletten
     * 32-Team-Spielstand samt SQLite-Datei. Einzeln gemessen liegen die schwersten davon bei rund
     * 5,1-5,7 s — also genau AUF der Grenze; unter paralleler Last kippen sie darueber. Ergebnis
     * waren 13 Fehlschlaege in 5 Dateien, die allesamt „Test timed out in 5000ms" hiessen und mit
     * dem Spiel nichts zu tun hatten. Beim Einzellauf derselben Dateien verschwand ein Teil davon
     * wieder — das klassische Bild eines zu knappen Timeouts, nicht eines echten Fehlers.
     *
     * Dass 5 s zu knapp ist, war im Code laengst anerkannt: die schwersten Tests tragen seit jeher
     * eigene `}, 20000)`- bzw. `}, 60000)`-Angaben. Nur bekamen sie eben nicht alle eine. Statt die
     * Zahl weiter einzeln nachzutragen, steht die realistische Grenze jetzt an einer Stelle.
     *
     * KEIN Verlust an Aussagekraft: die Performance-Zusicherungen dieser Suite messen selbst
     * (z. B. `useStateCallCount <= 233` in foundation-performance-architecture) und haengen nicht am
     * Test-Timeout. Ein echter Haenger faellt weiterhin auf — nur 15 s spaeter.
     */
    testTimeout: 20_000,
    setupFiles: ["tests/setup/sqlite-pro-testdatei.ts"],
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
