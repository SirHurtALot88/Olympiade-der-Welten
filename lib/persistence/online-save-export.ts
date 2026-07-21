/**
 * Geteilte Export-Logik für die "Online-Saves": schreibt die lokalen SQLite-Saves als
 * gzip-JSON nach `data/online-saves/`, damit sie ins GitHub-Repo committet und so überall
 * (jeder Clone/Deploy/jede Claude-Session) verfügbar sind. Wird sowohl vom CLI
 * (`scripts/save-export.ts`) als auch vom automatischen Server-Timer
 * (`online-save-auto-export.ts`) genutzt, damit beide exakt dieselbe Serialisierung schreiben.
 */
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

export const ONLINE_SAVES_DIR = path.join(process.cwd(), "data", "online-saves");
export const ONLINE_SAVES_MANIFEST = path.join(ONLINE_SAVES_DIR, "manifest.json");
export const ONLINE_SAVES_SCHEMA = "oly-online-saves-v1";

export type OnlineSaveManifestEntry = {
  saveId: string;
  name: string;
  status: string;
  file: string;
  uncompressedBytes: number;
  gzipBytes: number;
};

export type OnlineSaveExportResult = {
  dir: string;
  activeSaveId: string | null;
  saves: OnlineSaveManifestEntry[];
  /** True, wenn sich mindestens eine Save-Datei geändert/neu ergeben/entfernt hat (Manifest-Zeitstempel zählt NICHT). */
  changed: boolean;
};

function bytesEqual(filePath: string, next: Buffer) {
  if (!fs.existsSync(filePath)) return false;
  try {
    return Buffer.compare(fs.readFileSync(filePath), next) === 0;
  } catch {
    return false;
  }
}

/**
 * Exportiert Saves nach `data/online-saves/`. `changed` meldet ausschließlich echte
 * Save-Inhaltsänderungen (identische Saves werden NICHT neu geschrieben → keine Git-Churn),
 * damit ein Auto-Push nur bei echten Spielständen auslöst.
 */
export function exportOnlineSaves(opts?: { ids?: string[]; activeOnly?: boolean }): OnlineSaveExportResult {
  const persistence = createPersistenceService();
  const activeSaveId = persistence.getActiveSave()?.saveId ?? null;

  let summaries = persistence.listSaves();
  if (opts?.ids && opts.ids.length > 0) {
    const wanted = new Set(opts.ids);
    summaries = summaries.filter((s) => wanted.has(s.saveId));
  } else if (opts?.activeOnly) {
    summaries = summaries.filter((s) => s.status === "active");
  }

  fs.mkdirSync(ONLINE_SAVES_DIR, { recursive: true });
  let changed = false;

  // Verwaiste Dateien entfernen (Save gelöscht/umbenannt), damit der Ordner den aktuellen Stand zeigt.
  const keep = new Set(summaries.map((s) => `${s.saveId}.json.gz`).concat(["manifest.json"]));
  for (const file of fs.readdirSync(ONLINE_SAVES_DIR)) {
    if ((file.endsWith(".json.gz") || file === "manifest.json") && !keep.has(file)) {
      fs.rmSync(path.join(ONLINE_SAVES_DIR, file));
      changed = true;
    }
  }

  const saves: OnlineSaveManifestEntry[] = [];
  for (const summary of summaries) {
    const full = persistence.getSaveById(summary.saveId);
    if (!full) continue;
    const json = JSON.stringify(full);
    // gzipSync ist bei gleichem Input deterministisch (mtime=0) → identische Saves erzeugen
    // identische Bytes und werden übersprungen.
    const gz = gzipSync(Buffer.from(json, "utf8"), { level: 9 });
    const file = `${summary.saveId}.json.gz`;
    const filePath = path.join(ONLINE_SAVES_DIR, file);
    if (!bytesEqual(filePath, gz)) {
      fs.writeFileSync(filePath, gz);
      changed = true;
    }
    saves.push({
      saveId: summary.saveId,
      name: summary.name,
      status: summary.status,
      file,
      uncompressedBytes: Buffer.byteLength(json),
      gzipBytes: gz.byteLength,
    });
  }

  // Manifest nur bei echten Änderungen neu schreiben, damit der (immer neue) Zeitstempel keine Churn erzeugt.
  if (changed) {
    const manifest = {
      schemaVersion: ONLINE_SAVES_SCHEMA,
      exportedAt: new Date().toISOString(),
      activeSaveId,
      saves,
    };
    fs.writeFileSync(ONLINE_SAVES_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return { dir: ONLINE_SAVES_DIR, activeSaveId, saves, changed };
}
