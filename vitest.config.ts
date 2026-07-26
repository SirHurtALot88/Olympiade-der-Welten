import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
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
