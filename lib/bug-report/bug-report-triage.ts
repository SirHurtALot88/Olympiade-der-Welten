/**
 * TRIAGE ZU EINER BUG-MELDUNG — die Vorpruefung und die Entscheidung darueber.
 *
 * Getrennt von der Meldung selbst abgelegt, und zwar aus einem Grund: die Meldung ist ein PROTOKOLL.
 * Was der Melder gesehen hat und in welchem Zustand das Spiel war, ist nachtraeglich nicht mehr
 * feststellbar — wird in dieselbe Datei auch noch der Befund geschrieben, ist die Rohmeldung beim
 * ersten Schreibfehler des Agenten mit weg. Deshalb: `data/bug-reports/*.json` wird nie wieder
 * angefasst, die Bewertung liegt als Beileger unter `data/bug-reports/triage/<reportId>.md`.
 *
 * Markdown statt JSON, weil der Inhalt zum Lesen fuer einen Menschen da ist: Befund, Ursache,
 * Loesungsvorschlag. Nur der Kopf ist maschinenlesbar (`status:`, `titel:`), damit die Uebersicht
 * unter `npm run bugs:review` sortieren kann, was offen ist und was entschieden.
 */
import fs from "node:fs";
import path from "node:path";

import { BUG_REPORTS_DIR } from "@/lib/bug-report/bug-report-service";

export const BUG_TRIAGE_DIR = path.join(BUG_REPORTS_DIR, "triage");

/**
 * Der Weg einer Meldung. Bewusst kurz — jeder zusaetzliche Status ist einer, bei dem unklar wird,
 * wer gerade am Zug ist.
 *
 *   offen        — noch nicht angesehen.                        Am Zug: der Agent.
 *   vorgeprueft  — Befund und Loesungsvorschlag liegen vor.      Am Zug: Chris.
 *   angenommen   — Chris hat den Vorschlag freigegeben.          Am Zug: der Agent.
 *   abgelehnt    — soll nicht gefixt werden (kein Fehler, egal). Erledigt.
 *   erledigt     — der Fix ist gebaut und gemergt.               Erledigt.
 */
export const BUG_TRIAGE_STATUSES = ["offen", "vorgeprueft", "angenommen", "abgelehnt", "erledigt"] as const;
export type BugTriageStatus = (typeof BUG_TRIAGE_STATUSES)[number];

/** Status, bei denen noch jemand handeln muss — die Uebersicht zeigt sie zuerst. */
export const OPEN_TRIAGE_STATUSES: BugTriageStatus[] = ["offen", "vorgeprueft", "angenommen"];

export type BugTriage = {
  reportId: string;
  status: BugTriageStatus;
  /** Einzeiler fuer die Uebersicht — was ist kaputt, in den Worten des Pruefers. */
  titel: string | null;
  /** Wie schwer es wiegt. Frei gelassen, wenn der Pruefer sich nicht festlegen will. */
  schwere: "hoch" | "mittel" | "niedrig" | null;
  /** Der ganze Text unterhalb des Kopfes: Befund, Ursache, Vorschlag. */
  body: string;
  file: string;
};

function isTriageStatus(value: string): value is BugTriageStatus {
  return (BUG_TRIAGE_STATUSES as readonly string[]).includes(value);
}

/**
 * Liest den Kopf einer Triage-Datei. Absichtlich tolerant: eine von Hand editierte Notiz mit einem
 * Tippfehler im Status soll in der Uebersicht auftauchen (als "offen") statt zu verschwinden — eine
 * Meldung stillschweigend zu verlieren ist der einzige wirklich teure Fehler an dieser Stelle.
 */
export function parseTriage(reportId: string, raw: string, file: string): BugTriage {
  const lines = raw.split("\n");
  let status: BugTriageStatus = "offen";
  let titel: string | null = null;
  let schwere: BugTriage["schwere"] = null;
  let bodyStart = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    // Der Kopf endet bei der ersten Zeile, die kein "schluessel: wert" mehr ist.
    const match = /^(status|titel|schwere):\s*(.*)$/i.exec(line);
    if (!match) {
      if (line === "" && bodyStart === 0) continue;
      if (line.startsWith("#")) continue;
      bodyStart = index;
      break;
    }
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "status" && isTriageStatus(value)) status = value;
    if (key === "titel") titel = value || null;
    if (key === "schwere" && (value === "hoch" || value === "mittel" || value === "niedrig")) schwere = value;
    bodyStart = index + 1;
  }

  return { reportId, status, titel, schwere, body: lines.slice(bodyStart).join("\n").trim(), file };
}

export function readTriage(reportId: string): BugTriage | null {
  const file = path.join(BUG_TRIAGE_DIR, `${reportId}.md`);
  if (!fs.existsSync(file)) return null;
  try {
    return parseTriage(reportId, fs.readFileSync(file, "utf8"), file);
  } catch {
    return null;
  }
}

/** Schreibt die Vorpruefung. Ueberschreibt eine bestehende Notiz — die Rohmeldung bleibt unberuehrt. */
export function writeTriage(input: {
  reportId: string;
  status: BugTriageStatus;
  titel: string;
  schwere?: BugTriage["schwere"];
  body: string;
}): string {
  fs.mkdirSync(BUG_TRIAGE_DIR, { recursive: true });
  const file = path.join(BUG_TRIAGE_DIR, `${input.reportId}.md`);
  const head = [
    `status: ${input.status}`,
    `titel: ${input.titel}`,
    ...(input.schwere ? [`schwere: ${input.schwere}`] : []),
  ].join("\n");
  fs.writeFileSync(file, `${head}\n\n${input.body.trim()}\n`, "utf8");
  return file;
}
