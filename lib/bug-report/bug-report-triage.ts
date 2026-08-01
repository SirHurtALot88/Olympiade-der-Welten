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
 *   gebaut       — Fix gemergt, WIRKUNG NOCH UNBESTAETIGT.       Am Zug: wer bestaetigt.
 *   abgelehnt    — soll nicht gefixt werden (kein Fehler, egal). Erledigt.
 *   erledigt     — Fix gemergt UND die Wirkung belegt.           Erledigt.
 *
 * WARUM `gebaut` trotz der Regel "so wenige Status wie moeglich": Weil die Unterscheidung schon
 * einmal Schaden angerichtet hat. Die Cash-Meldung galt nach einem Merge als behoben — der Fix
 * stiess einen Reload an, der zwei Zeilen weiter von einem Zwischenspeicher verschluckt wurde. Ein
 * "erledigt", waehrend der Fehler weiterlebt, ist schlimmer als gar kein Eintrag: es nimmt die
 * Meldung aus dem Blick. Bei `gebaut` ist ausserdem klar, wer am Zug ist — der Bestaetiger.
 */
export const BUG_TRIAGE_STATUSES = [
  "offen",
  "vorgeprueft",
  "angenommen",
  "gebaut",
  "abgelehnt",
  "erledigt",
] as const;
export type BugTriageStatus = (typeof BUG_TRIAGE_STATUSES)[number];

/** Status, bei denen noch jemand handeln muss — die Uebersicht zeigt sie zuerst. */
export const OPEN_TRIAGE_STATUSES: BugTriageStatus[] = ["offen", "vorgeprueft", "angenommen", "gebaut"];

export type BugTriage = {
  reportId: string;
  status: BugTriageStatus;
  /** Einzeiler fuer die Uebersicht — was ist kaputt, in den Worten des Pruefers. */
  titel: string | null;
  /** Wie schwer es wiegt. Frei gelassen, wenn der Pruefer sich nicht festlegen will. */
  schwere: "hoch" | "mittel" | "niedrig" | null;
  /**
   * Die Gewichtung fuer den Changelog-Reiter (`grundlegend`, `spielblockierend`, `behebung`,
   * `feinschliff` — siehe `CHANGELOG_GEWICHTE` in `lib/changelog/changelog.ts`). Getrennt von
   * `schwere`, weil die beiden Verschiedenes messen: `schwere` sagt, wie dringend der Fehler WAR,
   * die Gewichtung sagt, was die Aenderung fuer den Spieler BEDEUTET. Bewusst als roher String —
   * ein Tippfehler soll die Notiz nicht unlesbar machen; die Pruefung gegen die erlaubten Werte
   * liegt auf der Changelog-Seite, wo eine unlesbare Angabe als Luecke angemahnt wird.
   */
  gewicht: string | null;
  /** Ein Satz Klartext: was am Ende dabei herausgekommen ist. Pflicht ab `gebaut`/`abgelehnt`. */
  ergebnis: string | null;
  /** PR des Fixes. Pflicht ab `gebaut`. */
  pr: string | null;
  /** Merge-Commit auf main. */
  commit: string | null;
  gemergt: string | null;
  /**
   * WIE die Wirkung belegt wurde — "Franky, live 31.07." oder "Playwright gegen den Live-Build".
   * Ohne diese Angabe gibt es kein `erledigt`; die Uebersicht stuft sonst auf `gebaut` zurueck.
   * Ein Beleg, der nicht sagt WIE geprueft wurde, ist keiner.
   */
  bestaetigt: string | null;
  /**
   * Ein Satz Alltagssprache fuer den Changelog-Reiter im Spiel: was war kaputt, was ist jetzt
   * anders. Er beschreibt die WIRKUNG, nicht den Eingriff — "der Kontostand aktualisiert sich
   * sofort", nicht "Ref-Cache entwertet". Nur Notizen ab `gebaut` landen im Changelog; die Zeile
   * hier zu pflegen gehoert in denselben Lauf wie der Merge (siehe docs/BUGFIXING_AGENT.md).
   */
  changelog: string | null;
  /**
   * Betroffene Seite in den Worten der Navigation ("Spieltag · Einsatzliste"). Normalerweise
   * kommt sie aus der Rohmeldung (`page.label`) — diese Zeile gibt es fuer Notizen OHNE
   * Rohmeldung (Zuruf im Gespraech statt Flagge), damit deren Changelog-Eintrag nicht ohne Ort
   * dasteht.
   */
  seite: string | null;
  /**
   * App-Version ("0.3.0"), in der der Fix steckt — optional, analog zur `changelog:`-Zeile. Nur
   * setzen, wenn die Version zum Merge-Zeitpunkt wirklich bekannt ist (siehe `package.json`);
   * sonst leer lassen statt zu raten.
   */
  version: string | null;
  /** Der ganze Text unterhalb des Kopfes: Befund, Ursache, Vorschlag. */
  body: string;
  file: string;
};

/** Kopfzeilen, die der Parser kennt. Alles andere beginnt den Fliesstext. */
const HEAD_KEYS = [
  "status",
  "titel",
  "schwere",
  "gewicht",
  "ergebnis",
  "pr",
  "commit",
  "gemergt",
  "bestaetigt",
  "changelog",
  "seite",
  "version",
] as const;

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
  const head = new Map<string, string>();
  const headPattern = new RegExp(`^(${HEAD_KEYS.join("|")}):\\s*(.*)$`, "i");
  let bodyStart = 0;
  // Der zuletzt gesetzte Schluessel — nur an DEN darf eine Fortsetzungszeile andocken. Ohne einen
  // bereits offenen Wert waere jede eingerueckte Fliesstext-Zeile (Aufzaehlung, Codeblock) faelschlich
  // eine Fortsetzung.
  let letzterSchluessel: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    const match = headPattern.exec(line);
    if (match) {
      const schluessel = match[1].toLowerCase();
      head.set(schluessel, match[2].trim());
      letzterSchluessel = schluessel;
      bodyStart = index + 1;
      continue;
    }
    // Fortsetzungszeile eines mehrzeiligen Werts: im Rohtext eingerueckt (nicht nur getrimmt leer)
    // UND haengt an einem bereits offenen Kopf-Schluessel. Zu einem Leerzeichen normalisiert, nicht
    // zusammengeklebt — sonst verschmelzen die letzten und ersten Woerter zweier Zeilen.
    const istFortsetzung = letzterSchluessel !== null && line !== "" && /^[ \t]/.test(rawLine);
    if (istFortsetzung && letzterSchluessel) {
      const bisher = head.get(letzterSchluessel) ?? "";
      head.set(letzterSchluessel, bisher ? `${bisher} ${line}` : line);
      bodyStart = index + 1;
      continue;
    }
    // Der Kopf endet bei der ersten Zeile, die weder ein bekanntes "schluessel: wert" noch eine
    // eingerueckte Fortsetzung ist. Der Fliesstext einer Notiz beginnt IMMER unindentiert (siehe
    // `writeTriage` und alle bestehenden Notizen) — genau das haelt ihn hier draussen.
    if (line === "" && bodyStart === 0) continue;
    if (line.startsWith("#")) continue;
    bodyStart = index;
    break;
  }

  const value = (key: string) => head.get(key)?.trim() || null;
  const rawStatus = value("status") ?? "";
  const schwereValue = value("schwere");
  const bestaetigt = value("bestaetigt");
  const parsedStatus: BugTriageStatus = isTriageStatus(rawStatus) ? rawStatus : "offen";

  return {
    reportId,
    // DER RIEGEL: `erledigt` ohne Beleg gilt als `gebaut`. Sonst verschwindet eine Meldung aus der
    // Uebersicht, weil jemand sie fuer behoben HIELT — genau so ging der Cash-Fehler durch.
    status: parsedStatus === "erledigt" && !bestaetigt ? "gebaut" : parsedStatus,
    titel: value("titel"),
    schwere: schwereValue === "hoch" || schwereValue === "mittel" || schwereValue === "niedrig" ? schwereValue : null,
    gewicht: value("gewicht"),
    ergebnis: value("ergebnis"),
    pr: value("pr"),
    commit: value("commit"),
    gemergt: value("gemergt"),
    bestaetigt,
    changelog: value("changelog"),
    seite: value("seite"),
    version: value("version"),
    body: lines.slice(bodyStart).join("\n").trim(),
    file,
  };
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
  gewicht?: string | null;
  ergebnis?: string | null;
  pr?: string | null;
  commit?: string | null;
  gemergt?: string | null;
  bestaetigt?: string | null;
  changelog?: string | null;
  seite?: string | null;
  version?: string | null;
  body: string;
}): string {
  fs.mkdirSync(BUG_TRIAGE_DIR, { recursive: true });
  const file = path.join(BUG_TRIAGE_DIR, `${input.reportId}.md`);
  const optional = (key: string, value: string | null | undefined) => (value ? [`${key}: ${value}`] : []);
  const head = [
    `status: ${input.status}`,
    `titel: ${input.titel}`,
    ...optional("schwere", input.schwere),
    ...optional("gewicht", input.gewicht),
    ...optional("ergebnis", input.ergebnis),
    ...optional("pr", input.pr),
    ...optional("commit", input.commit),
    ...optional("gemergt", input.gemergt),
    ...optional("bestaetigt", input.bestaetigt),
    ...optional("changelog", input.changelog),
    ...optional("seite", input.seite),
    ...optional("version", input.version),
  ].join("\n");
  fs.writeFileSync(file, `${head}\n\n${input.body.trim()}\n`, "utf8");
  return file;
}

/**
 * Was an einer Notiz noch fehlt, damit ihr Status glaubwuerdig ist. Der Generator schreibt diese
 * Saetze in die Tabelle — eine Luecke, die man SIEHT, ist der ganze Vorteil einer abgeleiteten
 * Tabelle gegenueber einer von Hand gepflegten, die stattdessen etwas Falsches behauptet.
 */
export function findTriageGaps(triage: BugTriage): string[] {
  const gaps: string[] = [];
  if ((triage.status === "gebaut" || triage.status === "erledigt") && !triage.pr) gaps.push("kein PR angegeben");
  if ((triage.status === "gebaut" || triage.status === "erledigt" || triage.status === "abgelehnt") && !triage.ergebnis) {
    gaps.push("kein Ergebnis angegeben");
  }
  if (triage.status === "gebaut" && !triage.bestaetigt) gaps.push("Wirkung nicht bestaetigt");
  // Ein gemergter Fix ohne Changelog-Zeile ist fuer den Spieler von einem ungefixten nicht zu
  // unterscheiden — deshalb zaehlt die fehlende Zeile als Luecke, nicht als Geschmacksfrage.
  if ((triage.status === "gebaut" || triage.status === "erledigt") && !triage.changelog) {
    gaps.push("keine changelog:-Zeile");
  }
  return gaps;
}
