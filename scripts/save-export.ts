/* eslint-disable no-console */
/**
 * Save-Export (CLI): schreibt die lokalen SQLite-Saves als gzip-JSON nach `data/online-saves/`,
 * damit sie ins GitHub-Repo committet und so "online"/überall (jeder Clone, Deploy, Claude-Session)
 * zugänglich werden. Gegenstück: `save-import.ts`. Die eigentliche Serialisierung lebt in
 * `lib/persistence/online-save-export.ts` (geteilt mit dem automatischen Server-Timer).
 *
 * Nutzung:
 *   npx tsx scripts/save-export.ts                 # ALLE Saves
 *   npx tsx scripts/save-export.ts --active-only   # nur aktive Saves
 *   npx tsx scripts/save-export.ts --id <saveId>   # gezielt (mehrfach möglich)
 *
 * Committet NICHT selbst — das übernimmt der Aufrufer (nur GitHub-Remote).
 */
import { loadEnvConfig } from "@next/env";

import { exportOnlineSaves } from "@/lib/persistence/online-save-export";

loadEnvConfig(process.cwd());

function parseArgs(argv: string[]) {
  const ids: string[] = [];
  let activeOnly = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--active-only") activeOnly = true;
    else if (arg === "--id") {
      const next = argv[i + 1];
      if (next) {
        ids.push(next);
        i += 1;
      }
    }
  }
  return { ids, activeOnly };
}

function main() {
  const { ids, activeOnly } = parseArgs(process.argv.slice(2));
  const result = exportOnlineSaves({ ids, activeOnly });

  if (result.saves.length === 0) {
    console.log("Keine passenden Saves zum Export gefunden.");
    return;
  }

  for (const save of result.saves) {
    console.log(
      `  ${save.status.padEnd(9)} ${save.saveId.padEnd(34)} ` +
        `${(save.uncompressedBytes / 1024 / 1024).toFixed(1)} MB → ${(save.gzipBytes / 1024 / 1024).toFixed(2)} MB gz`,
    );
  }
  const totalGz = result.saves.reduce((sum, s) => sum + s.gzipBytes, 0);
  console.log(
    `\n${result.changed ? "Export aktualisiert" : "Keine Änderung (Saves identisch)"}: ${result.saves.length} Save(s) → ` +
      `${result.dir} (${(totalGz / 1024 / 1024).toFixed(2)} MB gz gesamt, aktiv=${result.activeSaveId ?? "—"}).`,
  );
  if (result.changed) console.log("Jetzt committen + auf GitHub pushen, damit die Saves online sind.");
}

main();
