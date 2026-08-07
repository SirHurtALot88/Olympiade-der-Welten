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
export function exportOnlineSaves(opts?: { ids?: string[]; activeOnly?: boolean; prune?: boolean }): OnlineSaveExportResult {
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

  // Verwaiste Dateien entfernen (Save gelöscht/umbenannt), damit der Ordner den aktuellen Stand zeigt
  // — ein lokal gelöschter Spielstand verschwindet so auch aus dem Repo.
  //
  // NUR beim VOLLSTÄNDIGEN Export. Bei `--active-only` oder `--id` enthält `summaries` absichtlich
  // nur eine Teilmenge; würde man danach aufräumen, löschte ein gezielter Export jeden anderen
  // Spielstand aus `data/online-saves/` — aus "exportiere diesen einen" würde "wirf alle anderen weg".
  // Der Auto-Export-Timer ruft ohne Filter auf, der Löschabgleich läuft dort also weiterhin.
  //
  // `prune: false` schaltet den Abgleich ganz ab. Der Auto-Export-Timer nutzt das, und zwar aus
  // einem konkreten Schaden heraus:
  //
  // Der Timer laeuft in JEDER Umgebung, die den Server startet — auch in einem frischen Container
  // oder einer Agenten-Sitzung, deren Store nur Smoke- und Audit-Saves enthaelt. Mit Abgleich
  // loescht so eine Umgebung jede Save-Datei, die sie selbst nicht hat, und pusht die Loeschung
  // nach `main`. Ein echter Spielstand, der dort liegt, ist damit weg, sobald irgendwo ein
  // Testcontainer hochfaehrt. Genau das ist der Grund, warum in `data/online-saves/` ueber die
  // ganze Historie nur Testartefakte stehen.
  //
  // Aufraeumen bleibt beim ausdruecklichen CLI-Export (`scripts/save-export.ts`) — dort steht ein
  // Mensch davor, der weiss, welcher Store der massgebliche ist. Der Preis ist, dass verwaiste
  // Dateien laenger liegen bleiben; das ist deutlich billiger als ein geloeschter Spielstand.
  const isFullExport = !(opts?.ids && opts.ids.length > 0) && !opts?.activeOnly;
  if (isFullExport && opts?.prune !== false) {
    const keep = new Set(summaries.map((s) => `${s.saveId}.json.gz`).concat(["manifest.json"]));
    for (const file of fs.readdirSync(ONLINE_SAVES_DIR)) {
      if ((file.endsWith(".json.gz") || file === "manifest.json") && !keep.has(file)) {
        fs.rmSync(path.join(ONLINE_SAVES_DIR, file));
        changed = true;
      }
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

  /**
   * FREMDE EINTRAEGE UEBERLEBEN DEN UNBEAUFSICHTIGTEN EXPORT.
   *
   * Die Dateien nicht mehr zu loeschen (`prune: false`) reicht allein nicht: der Importeur liest
   * das MANIFEST, nicht das Verzeichnis. Wuerde eine Testumgebung das Manifest weiterhin komplett
   * durch ihre eigene Liste ersetzen, laegen fremde Spielstaende zwar noch als Datei da, waeren
   * aber fuer jeden Import unsichtbar — der Schaden waere derselbe, nur schwerer zu sehen.
   *
   * Deshalb: Eintraege, die dieser Store nicht kennt, deren Datei aber noch existiert, werden aus
   * dem vorhandenen Manifest uebernommen. Und `activeSaveId` wird nicht ueberschrieben, wenn er auf
   * einen solchen fremden Spielstand zeigt — der Zeiger gehoert der Umgebung, die ihn gesetzt hat.
   */
  const zusammengefuehrt =
    opts?.prune === false
      ? mergeManifestForUnattendedExport({
          ownEntries: saves,
          ownActiveSaveId: activeSaveId,
          existingEntries: readExistingManifestEntries(),
          existingActiveSaveId: readExistingManifestActiveSaveId(),
          fileExists: (file) => fs.existsSync(path.join(ONLINE_SAVES_DIR, file)),
        })
      : { saves, activeSaveId, keptForeignEntries: 0 };
  const manifestSaves = zusammengefuehrt.saves;
  const manifestActiveSaveId = zusammengefuehrt.activeSaveId;
  if (zusammengefuehrt.keptForeignEntries > 0 && !manifestListsExactly(manifestSaves)) {
    changed = true;
  }

  // Manifest nur bei echten Änderungen neu schreiben, damit der (immer neue) Zeitstempel keine Churn erzeugt.
  if (changed) {
    const manifest = {
      schemaVersion: ONLINE_SAVES_SCHEMA,
      exportedAt: new Date().toISOString(),
      activeSaveId: manifestActiveSaveId,
      saves: manifestSaves,
    };
    fs.writeFileSync(ONLINE_SAVES_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return { dir: ONLINE_SAVES_DIR, activeSaveId: manifestActiveSaveId, saves: manifestSaves, changed };
}

/**
 * Was beim UNBEAUFSICHTIGTEN Export ins Manifest gehoert — rein rechnend, ohne Dateisystem, damit
 * die Regel pruefbar ist, ohne einen echten `data/online-saves/`-Ordner anzufassen.
 *
 * Regel: die eigenen Eintraege gewinnen, fremde bleiben erhalten, solange ihre Datei noch da ist.
 * Der `activeSaveId`-Zeiger wird nicht uebernommen, wenn er auf einen fremden Spielstand zeigt —
 * die Umgebung, die ihn gesetzt hat, weiss besser, was der massgebliche Stand ist als ein
 * Testcontainer, der zufaellig gerade laeuft.
 */
export function mergeManifestForUnattendedExport(input: {
  ownEntries: OnlineSaveManifestEntry[];
  ownActiveSaveId: string | null;
  existingEntries: OnlineSaveManifestEntry[];
  existingActiveSaveId: string | null;
  fileExists: (file: string) => boolean;
}): { saves: OnlineSaveManifestEntry[]; activeSaveId: string | null; keptForeignEntries: number } {
  const eigene = new Set(input.ownEntries.map((entry) => entry.saveId));
  const fremde = input.existingEntries.filter((entry) => !eigene.has(entry.saveId) && input.fileExists(entry.file));

  // Der fremde Zeiger bleibt nur stehen, wenn der Spielstand, auf den er zeigt, auch WIRKLICH noch
  // da ist. Sonst zeigte das Manifest auf eine geloeschte Datei, und der Import liefe ins Leere.
  const behaelt = new Set(fremde.map((entry) => entry.saveId));
  const behaeltFremdenZeiger = Boolean(input.existingActiveSaveId) && behaelt.has(input.existingActiveSaveId ?? "");

  return {
    saves: [...input.ownEntries, ...fremde],
    activeSaveId: behaeltFremdenZeiger ? input.existingActiveSaveId : input.ownActiveSaveId,
    keptForeignEntries: fremde.length,
  };
}

function readExistingManifest(): { activeSaveId?: string | null; saves?: OnlineSaveManifestEntry[] } | null {
  try {
    if (!fs.existsSync(ONLINE_SAVES_MANIFEST)) return null;
    return JSON.parse(fs.readFileSync(ONLINE_SAVES_MANIFEST, "utf8"));
  } catch {
    // Ein kaputtes Manifest darf den Export nicht anhalten — dann gibt es eben nichts zu erhalten.
    return null;
  }
}

function readExistingManifestEntries(): OnlineSaveManifestEntry[] {
  const manifest = readExistingManifest();
  return Array.isArray(manifest?.saves) ? manifest.saves.filter((entry) => entry?.saveId && entry?.file) : [];
}

function readExistingManifestActiveSaveId(): string | null {
  return readExistingManifest()?.activeSaveId ?? null;
}

/** Steht im vorhandenen Manifest bereits genau diese Save-Liste? Dann gibt es nichts zu schreiben. */
function manifestListsExactly(entries: OnlineSaveManifestEntry[]): boolean {
  const vorhanden = readExistingManifestEntries()
    .map((entry) => entry.saveId)
    .sort();
  const gewuenscht = entries.map((entry) => entry.saveId).sort();
  return vorhanden.length === gewuenscht.length && vorhanden.every((saveId, index) => saveId === gewuenscht[index]);
}
