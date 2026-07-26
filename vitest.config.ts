import path from "node:path";

import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    // tests/ui-cockpit-playtest.spec.js (and any future "*.spec.js" file in
    // tests/) is a Playwright end-to-end spec (see playwright.config.ts,
    // testMatch: "ui-cockpit-playtest.spec.js") that requires "@playwright/test"
    // and drives a real dev server — it has 0 vitest tests, but vitest's
    // default include glob still picks it up and fails at collection time
    // ("Playwright Test did not expect test() to be called here"). Exclude
    // Playwright specs explicitly so `npx vitest run` only ever collects
    // vitest test files.
    exclude: [...defaultExclude, "**/tests/*.spec.js"],
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
