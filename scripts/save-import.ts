/* eslint-disable no-console */
/**
 * Save-Import: lädt die in `data/online-saves/` abgelegten (gzip-)JSON-Saves in den lokalen
 * SQLite-Store. Gegenstück zu `save-export.ts`. Damit kann JEDE Umgebung (frischer Container,
 * neues Deploy, Claude-Session) die online abgelegten Saves wiederherstellen und weiterspielen
 * bzw. Bugs darin reproduzieren/fixen.
 *
 * `saveGameState` ist ein Upsert (INSERT ... ON CONFLICT DO UPDATE), legt also fehlende Saves
 * neu an — ein leerer/frischer Store wird korrekt befüllt.
 *
 * Nutzung:
 *   npx tsx scripts/save-import.ts                    # ALLE Saves aus dem Manifest importieren
 *   npx tsx scripts/save-import.ts --id <saveId>      # gezielt einen Save (mehrfach möglich)
 *   npx tsx scripts/save-import.ts --no-activate      # aktiven Save NICHT umsetzen
 */
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { loadEnvConfig } from "@next/env";

import { createSaveRepository } from "@/lib/persistence/save-repository";
import type { PersistedSaveGame } from "@/lib/persistence/types";

loadEnvConfig(process.cwd());

// WICHTIG: `--only-if-empty` importiert NUR, wenn der lokale Store noch keine Saves hat.
// So kann der SessionStart-Hook eine frische Umgebung befüllen, ohne eine Umgebung zu
// überschreiben, in der bereits echte Spielstände liegen (kein Clobbern des aktiven Saves).

const ONLINE_SAVES_DIR = path.join(process.cwd(), "data", "online-saves");
const MANIFEST_PATH = path.join(ONLINE_SAVES_DIR, "manifest.json");

type Manifest = {
  schemaVersion: string;
  exportedAt: string;
  gitCommit: string | null;
  activeSaveId: string | null;
  saves: Array<{ saveId: string; name: string; status: string; file: string }>;
};

function parseArgs(argv: string[]) {
  const ids: string[] = [];
  let activate = true;
  let onlyIfEmpty = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-activate") activate = false;
    else if (arg === "--only-if-empty") onlyIfEmpty = true;
    else if (arg === "--id") {
      const next = argv[i + 1];
      if (next) {
        ids.push(next);
        i += 1;
      }
    }
  }
  return { ids, activate, onlyIfEmpty };
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Kein Manifest gefunden: ${MANIFEST_PATH}. Zuerst exportieren (scripts/save-export.ts).`);
    process.exit(1);
  }
  const { ids, activate, onlyIfEmpty } = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  const repo = createSaveRepository();

  if (onlyIfEmpty && repo.listSaves().length > 0) {
    console.log("Store enthält bereits Saves → Import übersprungen (--only-if-empty). Bestehende Spielstände bleiben unangetastet.");
    return;
  }

  let entries = manifest.saves;
  if (ids.length > 0) {
    const wanted = new Set(ids);
    entries = entries.filter((e) => wanted.has(e.saveId));
  }
  if (entries.length === 0) {
    console.log("Keine passenden Saves im Manifest.");
    return;
  }

  let imported = 0;
  for (const entry of entries) {
    const filePath = path.join(ONLINE_SAVES_DIR, entry.file);
    if (!fs.existsSync(filePath)) {
      console.log(`  ÜBERSPRUNGEN (Datei fehlt): ${entry.file}`);
      continue;
    }
    const raw = entry.file.endsWith(".gz")
      ? gunzipSync(fs.readFileSync(filePath)).toString("utf8")
      : fs.readFileSync(filePath, "utf8");
    const save = JSON.parse(raw) as PersistedSaveGame;
    repo.saveGameState({
      saveId: save.saveId,
      name: save.name,
      status: save.status,
      gameState: save.gameState,
    });
    imported += 1;
    console.log(`  OK importiert: ${entry.status.padEnd(9)} ${entry.saveId.padEnd(34)} "${entry.name}"`);
  }

  if (activate && manifest.activeSaveId && entries.some((e) => e.saveId === manifest.activeSaveId)) {
    repo.setActiveSave(manifest.activeSaveId);
    console.log(`  Aktiver Save gesetzt: ${manifest.activeSaveId}`);
  }

  console.log(
    `\nImport fertig: ${imported} Save(s) aus ${ONLINE_SAVES_DIR} in den lokalen Store geschrieben` +
      `${manifest.gitCommit ? ` (Export-Commit ${manifest.gitCommit.slice(0, 8)})` : ""}.`,
  );
}

main();
