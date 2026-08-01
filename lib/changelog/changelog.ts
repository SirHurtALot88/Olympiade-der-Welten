/**
 * DER CHANGELOG — was sich im Spiel geaendert hat, in Saetzen fuer Spieler.
 *
 * Ein gemergter Fix, von dem niemand erfaehrt, ist fuer den Spieler nicht von einem ungefixten zu
 * unterscheiden. Der Changelog schliesst diese Luecke: unterster Reiter im Spiel, ein Satz pro
 * Aenderung — was war kaputt, was ist jetzt anders. Kein Entwicklerjargon, keine Dateinamen; die
 * PR-Nummer bleibt als einziger Beleg stehen.
 *
 * Zwei Quellen, ein Ergebnis:
 *   1. Triage-Notizen (`data/bug-reports/triage/<reportId>.md`) mit einer `changelog:`-Kopfzeile —
 *      fuer alles, was als Bug gemeldet und gefixt wurde.
 *   2. `data/changelog/eintraege.json` — von Hand gepflegt, fuer Aenderungen OHNE Bug-Meldung
 *      (neues Feature, umgebaute Ansicht). Der Changelog beantwortet "was hat sich geaendert",
 *      nicht "welche Tickets gab es".
 *
 * Diese Datei ist bewusst frei von Datei-Zugriffen, damit der Spiel-Reiter sie mitladen kann —
 * das Einsammeln aus dem Dateisystem liegt in `lib/changelog/changelog-quellen.ts`.
 */
import type { BugTriage, BugTriageStatus } from "@/lib/bug-report/bug-report-triage";

export type ChangelogEintrag = {
  /** ISO-Datum (JJJJ-MM-TT) des Merges — der Tag, ab dem die Aenderung im Spiel ist. */
  datum: string;
  /** Betroffene Seite in den Worten der Navigation ("Markt · Transfermarkt"). */
  seite: string | null;
  /** PR-Nummer als Beleg ("#273"). Der einzige Entwickler-Verweis, bewusst dezent. */
  pr: string | null;
  /** Der eine Satz: was war kaputt, was ist jetzt anders. */
  text: string;
  /** Woher der Eintrag stammt — nur fuer Nachvollziehbarkeit, die Oberflaeche zeigt es nicht. */
  quelle: "triage" | "gepflegt";
};

/**
 * Nur diese Status erscheinen im Changelog. Was noch nicht gemergt ist (`vorgeprueft`,
 * `angenommen`), hat dort nichts verloren — sonst verspricht der Changelog Fixes, die es im
 * laufenden Spiel gar nicht gibt.
 */
export const CHANGELOG_STATUSES: readonly BugTriageStatus[] = ["gebaut", "erledigt"];

/**
 * Zieht ein Datum aus einem freien Textfeld (`gemergt:` ist Freitext). Verstanden werden
 * ISO ("2026-07-30", auch mit Anhang wie "2026-07-30, squash") und deutsch ("30.07.2026").
 * Alles andere ist kein Datum — lieber null als ein geratener Tag im Changelog.
 */
export function normalisiereChangelogDatum(wert: string | null | undefined): string | null {
  if (!wert) return null;
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(wert);
  const deutsch = iso ? null : /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(wert);
  const jahr = iso ? Number(iso[1]) : deutsch ? Number(deutsch[3]) : null;
  const monat = iso ? Number(iso[2]) : deutsch ? Number(deutsch[2]) : null;
  const tag = iso ? Number(iso[3]) : deutsch ? Number(deutsch[1]) : null;
  if (jahr == null || monat == null || tag == null) return null;
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

/**
 * Ergebnis pro Triage-Notiz. Die Unterscheidung "kein Eintrag" vs. "Luecke" ist der Kern:
 * eine Notiz auf `vorgeprueft` OHNE Eintrag ist richtig so — eine Notiz auf `gebaut` ohne
 * brauchbaren Eintrag ist ein gemergter Fix, den der Spieler nie sieht. Die zweite muss der
 * Generator anmahnen, die erste nicht.
 */
export type TriageChangelogErgebnis =
  | { art: "eintrag"; eintrag: ChangelogEintrag }
  | { art: "kein-eintrag" }
  | { art: "luecke"; grund: string };

/**
 * Baut aus einer Triage-Notiz den Changelog-Eintrag. `seiteAusMeldung` kommt aus der Rohmeldung
 * (`page.label`) — sie gewinnt gegen die `seite:`-Zeile der Notiz, weil die Rohmeldung festhaelt,
 * wo der Melder wirklich stand, waehrend die Notiz-Zeile nur der Notnagel fuer Zurufe ohne
 * Rohmeldung ist.
 */
export function changelogAusTriage(triage: BugTriage, seiteAusMeldung: string | null): TriageChangelogErgebnis {
  if (!CHANGELOG_STATUSES.includes(triage.status)) return { art: "kein-eintrag" };
  if (!triage.changelog) return { art: "luecke", grund: "keine changelog:-Zeile" };
  const datum = normalisiereChangelogDatum(triage.gemergt);
  if (!datum) return { art: "luecke", grund: "kein lesbares gemergt:-Datum" };
  return {
    art: "eintrag",
    eintrag: {
      datum,
      seite: seiteAusMeldung ?? triage.seite,
      pr: triage.pr,
      text: triage.changelog,
      quelle: "triage",
    },
  };
}

/**
 * Prueft einen von Hand gepflegten Eintrag (aus `eintraege.json` oder aus der generierten Datei).
 * Absichtlich tolerant: ein einzelner kaputter Eintrag faellt heraus, statt den ganzen Changelog
 * zu reissen — der Reiter im Spiel darf an einem Tippfehler in einer Datenzeile nicht scheitern.
 */
export function parseChangelogEintrag(roh: unknown): ChangelogEintrag | null {
  if (typeof roh !== "object" || roh === null) return null;
  const wert = roh as Record<string, unknown>;
  const datum = normalisiereChangelogDatum(typeof wert.datum === "string" ? wert.datum : null);
  const text = typeof wert.text === "string" ? wert.text.trim() : "";
  if (!datum || !text) return null;
  return {
    datum,
    seite: typeof wert.seite === "string" && wert.seite.trim() ? wert.seite.trim() : null,
    pr: typeof wert.pr === "string" && wert.pr.trim() ? wert.pr.trim() : null,
    text,
    quelle: wert.quelle === "triage" ? "triage" : "gepflegt",
  };
}

/**
 * Liest die generierte Datei (`data/changelog/CHANGELOG.json`), wie der Spiel-Reiter sie
 * importiert. Gleiche Toleranz wie beim Einzel-Eintrag: was nicht passt, faellt heraus.
 */
export function parseChangelogDatei(roh: unknown): ChangelogEintrag[] {
  if (typeof roh !== "object" || roh === null) return [];
  const eintraege = (roh as Record<string, unknown>).eintraege;
  if (!Array.isArray(eintraege)) return [];
  return eintraege
    .map(parseChangelogEintrag)
    .filter((eintrag): eintrag is ChangelogEintrag => eintrag !== null);
}

/**
 * Neueste zuerst. Innerhalb eines Tages bleibt die Eingangsreihenfolge stehen (stabil) — die
 * Quellen liefern Triage-Eintraege vor gepflegten, und diese Ordnung soll kein Sortierlauf
 * stillschweigend umwerfen.
 */
export function sortiereChangelog(eintraege: ChangelogEintrag[]): ChangelogEintrag[] {
  return [...eintraege].sort((links, rechts) => rechts.datum.localeCompare(links.datum));
}

export type ChangelogTagesgruppe = { datum: string; eintraege: ChangelogEintrag[] };

/** Gruppiert bereits sortierte Eintraege nach Tag — die Anzeigeform des Reiters. */
export function gruppiereChangelogNachDatum(eintraege: ChangelogEintrag[]): ChangelogTagesgruppe[] {
  const gruppen: ChangelogTagesgruppe[] = [];
  for (const eintrag of eintraege) {
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && letzte.datum === eintrag.datum) {
      letzte.eintraege.push(eintrag);
    } else {
      gruppen.push({ datum: eintrag.datum, eintraege: [eintrag] });
    }
  }
  return gruppen;
}
