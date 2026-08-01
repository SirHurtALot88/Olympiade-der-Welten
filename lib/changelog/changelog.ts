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

/**
 * DIE GEWICHTUNG — vier Stufen, in Anzeige-Reihenfolge. Bewusst nicht mehr: ab der fuenften Stufe
 * entscheidet niemand mehr richtig, welche gemeint ist. Die Namen gelten fuer jemanden, der das
 * Spiel SPIELT, nicht fuer Entwickler:
 *
 *   grundlegend      — etwas Grundlegendes ist neu oder umgebaut (Sponsorsystem, neuer Reiter).
 *   spielblockierend — etwas verhinderte das Weiterspielen und ist behoben (Spieltag liess sich
 *                      nicht abschliessen, Verkaeufe dauerhaft gesperrt).
 *   behebung         — eine normale Behebung: das Spiel lief weiter, aber falsch.
 *   feinschliff      — Beschriftung, Farbe, Kleinigkeit.
 *
 * Die Reihenfolge ist zugleich die Ordnung des Reiters: erst was am Spiel neu ist, dann ob der
 * eigene Blocker weg ist, dann der Rest. `null` heisst "die Quelle sagt nichts" — das bleibt
 * sichtbar (eigener Abschnitt am Ende, Mahnung im Generator) statt still geraten zu werden.
 */
export const CHANGELOG_GEWICHTE = ["grundlegend", "spielblockierend", "behebung", "feinschliff"] as const;
export type ChangelogGewicht = (typeof CHANGELOG_GEWICHTE)[number];

/** Beschriftung der Stufen im Reiter — Spielersprache, kein Entwicklerjargon. */
export const CHANGELOG_GEWICHT_BESCHRIFTUNG: Record<ChangelogGewicht, { titel: string; erklaerung: string }> = {
  grundlegend: { titel: "Groß umgebaut & neu", erklaerung: "Neue oder grundlegend umgebaute Teile des Spiels." },
  spielblockierend: { titel: "Spielblocker behoben", erklaerung: "Fehler, die das Weiterspielen verhindert haben." },
  behebung: { titel: "Behoben", erklaerung: "Fehler, die das Spiel gestört haben." },
  feinschliff: { titel: "Feinschliff", erklaerung: "Beschriftungen, Farben, Kleinigkeiten." },
};

/** Prueft einen freien Wert gegen die vier Stufen. Alles andere ist keine Stufe — lieber null als geraten. */
export function normalisiereChangelogGewicht(wert: string | null | undefined): ChangelogGewicht | null {
  if (!wert) return null;
  const bereinigt = wert.trim().toLowerCase();
  return (CHANGELOG_GEWICHTE as readonly string[]).includes(bereinigt) ? (bereinigt as ChangelogGewicht) : null;
}

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
  /**
   * Die Gewichtung — bestimmt, in welchem Abschnitt des Reiters der Eintrag steht. `null` heisst
   * "die Quelle hat nichts gesagt": der Eintrag erscheint trotzdem (ein gemergter Fix darf nicht
   * an einer fehlenden Einstufung scheitern), aber erkennbar uneingestuft, und der Generator
   * mahnt es an — genau wie bei fehlender changelog:-Zeile.
   */
  gewicht: ChangelogGewicht | null;
  /**
   * Optionale App-Version ("0.3.0"), in der die Aenderung steckt. Freitext statt strengem Semver,
   * weil die Quellen es nicht anders liefern (eine `version:`-Zeile in der Triage-Notiz oder das
   * Feld in `eintraege.json`). Faelt bei aelteren Eintraegen bewusst fehlen: welche Version sie
   * enthielt, ist nachtraeglich nicht mehr zuverlaessig feststellbar — eine geratene Zuordnung waere
   * eine Falschaussage. Fehlt sie, landet der Eintrag im Reiter unter "Ohne Versionsangabe".
   */
  version: string | null;
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
 * Bestimmt die Gewichtung einer Triage-Notiz.
 *
 * Vorrang hat die ausdrueckliche `gewicht:`-Zeile. Steht sie da, ist aber unlesbar (Tippfehler),
 * gibt es KEINEN Rueckfall — sonst wuerde der Tippfehler still zu einer anderen Stufe, statt als
 * Luecke aufzufallen und korrigiert zu werden.
 *
 * DER RUECKFALL AUS `schwere:`, wenn die Zeile fehlt: `niedrig` wird `feinschliff` (das sagt
 * niedrig genau aus), `mittel` und `hoch` werden beide `behebung`. Bewusst NIE `spielblockierend`
 * oder `grundlegend`: `schwere` misst, wie dringend der Fehler war — der falsch beschriftete
 * „Bester Fit" stand auf `hoch` und blockierte trotzdem nichts. "Du kamst nicht weiter" und
 * "hier wurde umgebaut" sind Behauptungen gegenueber dem Spieler, die jemand ausdruecklich
 * treffen muss, nicht Nebenwirkungen einer Dringlichkeitsangabe.
 */
export function gewichtAusTriage(triage: Pick<BugTriage, "gewicht" | "schwere">): ChangelogGewicht | null {
  if (triage.gewicht !== null) return normalisiereChangelogGewicht(triage.gewicht);
  if (triage.schwere === "niedrig") return "feinschliff";
  if (triage.schwere === "mittel" || triage.schwere === "hoch") return "behebung";
  return null;
}

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
      gewicht: gewichtAusTriage(triage),
      version: triage.version,
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
    // Ein unlesbares Gewicht faellt auf null — der Eintrag bleibt, aber sichtbar uneingestuft.
    gewicht: normalisiereChangelogGewicht(typeof wert.gewicht === "string" ? wert.gewicht : null),
    version: typeof wert.version === "string" && wert.version.trim() ? wert.version.trim() : null,
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
 * Wirft woertliche Doppel heraus: gleicher Tag, gleicher Satz = EIN Eintrag fuer den Spieler.
 * Der Fall ist real — zwei Meldungen derselben Sache (Arena- und Saisonstand-Sicht des
 * Rang-Fehlers) bekommen je eine Triage-Notiz, der Fix ist aber einer, und der Changelog
 * beantwortet "was hat sich geaendert", nicht "welche Tickets gab es". Der erste Eintrag
 * gewinnt; absichtlich NUR bei woertlich gleichem Text — aehnliche Saetze zusammenzulegen
 * waere Raten, und geraten wird hier nirgends.
 */
export function dedupliziereChangelog(eintraege: ChangelogEintrag[]): ChangelogEintrag[] {
  const gesehen = new Set<string>();
  return eintraege.filter((eintrag) => {
    const schluessel = `${eintrag.datum} ${eintrag.text}`;
    if (gesehen.has(schluessel)) return false;
    gesehen.add(schluessel);
    return true;
  });
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

/** Gruppiert bereits sortierte Eintraege nach Tag — ein Baustein der Anzeige (siehe unten). */
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

export type ChangelogGewichtsgruppe = {
  /** null = "ohne Einstufung" — der Abschnitt fuer Eintraege, deren Quelle nichts hergab. */
  gewicht: ChangelogGewicht | null;
  eintraege: ChangelogEintrag[];
};

/**
 * Gruppiert nach Gewichtung, in der festen Reihenfolge von `CHANGELOG_GEWICHTE` — die oberste
 * Ebene des Reiters. WARUM GEWICHT VOR DATUM: Chris' Frage beim Oeffnen ist "was war gross?",
 * nicht "was war am Dienstag?" — ein Sponsoren-Umbau muss oben stehen, auch wenn seither drei
 * Tage Feinschliff gemergt wurden. Innerhalb eines Abschnitts bleibt die Eingangsreihenfolge
 * (neueste zuerst) stehen, dort uebernimmt `gruppiereChangelogNachDatum` wieder — die
 * Tagesgruppierung bleibt als Baustein bestehen, nur eine Ebene tiefer.
 *
 * Leere Stufen erscheinen nicht; Eintraege OHNE Gewichtung bilden den letzten Abschnitt, statt
 * herauszufallen oder still einer Stufe zugeschlagen zu werden.
 */
export function gruppiereChangelogNachGewicht(eintraege: ChangelogEintrag[]): ChangelogGewichtsgruppe[] {
  const stufen: Array<ChangelogGewicht | null> = [...CHANGELOG_GEWICHTE, null];
  return stufen
    .map((gewicht) => ({ gewicht, eintraege: eintraege.filter((eintrag) => eintrag.gewicht === gewicht) }))
    .filter((gruppe) => gruppe.eintraege.length > 0);
}

export type ChangelogVersionsgruppe = { version: string | null; eintraege: ChangelogEintrag[] };

/**
 * Vergleicht zwei Versionsangaben absteigend, numerisches Segment fuer Segment ("0.10" vor "0.3").
 * Freitext-tolerant: alles, was kein Ziffernblock ist (z.B. ein "v"-Praefix), wird uebersprungen;
 * fehlende Segmente zaehlen als 0, damit "0.3" und "0.3.0" gleichrangig sind.
 */
function vergleicheVersionenAbsteigend(a: string, b: string): number {
  const segmente = (wert: string) => wert.split(/[^0-9]+/).filter((teil) => teil !== "").map(Number);
  const segA = segmente(a);
  const segB = segmente(b);
  const laenge = Math.max(segA.length, segB.length);
  for (let index = 0; index < laenge; index += 1) {
    const x = segA[index] ?? 0;
    const y = segB[index] ?? 0;
    if (x !== y) return y - x;
  }
  return 0;
}

/**
 * Gruppiert bereits sortierte (neueste zuerst) Eintraege nach Version — die aeussere Gliederung
 * des Reiters, sobald Versionsangaben vorhanden sind. Eintraege ohne `version` verschwinden nicht:
 * sie landen gesammelt in einer eigenen Gruppe mit `version: null` (Oberflaeche zeigt dafuer eine
 * ehrliche Sammelueberschrift, "Ohne Versionsangabe"), immer als letzte Gruppe — sie ist der
 * Auffangkorb, keine echte Versionsangabe, die um einen Sortierplatz mitspielt.
 */
export function gruppiereChangelogNachVersion(eintraege: ChangelogEintrag[]): ChangelogVersionsgruppe[] {
  const nachVersion = new Map<string, ChangelogEintrag[]>();
  const ohneVersion: ChangelogEintrag[] = [];
  for (const eintrag of eintraege) {
    if (eintrag.version) {
      const liste = nachVersion.get(eintrag.version) ?? [];
      liste.push(eintrag);
      nachVersion.set(eintrag.version, liste);
    } else {
      ohneVersion.push(eintrag);
    }
  }
  const gruppen: ChangelogVersionsgruppe[] = [...nachVersion.entries()]
    .sort((links, rechts) => vergleicheVersionenAbsteigend(links[0], rechts[0]))
    .map(([version, eintraege]) => ({ version, eintraege }));
  if (ohneVersion.length > 0) gruppen.push({ version: null, eintraege: ohneVersion });
  return gruppen;
}
