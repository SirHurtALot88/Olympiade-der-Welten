/**
 * KADERSTÄRKE JE DISZIPLIN UND RANG IN DER LIGA (Transfermarkt neu, 18.11.).
 *
 * Eine Quelle für Markt, Verhandlungstisch, Verkauf und Verträge. Stärke einer Disziplin = Ø der besten sechs
 * Eignungswerte des Kaders (verletzte zählen nicht, fehlende Plätze zählen mit `FEHLPLATZ_WERT`); Rang = 1 + Zahl der
 * Teams der Liga mit größerer Stärke. Das spiegelt die vorhandene Top-Sechs-Logik von `transfermarkt-roster-impact.ts`
 * und erweitert sie auf alle 20 Disziplinen und den Liga-Rang (Doku, Abschnitt 3, offene Frage 10: Einsatzplätze
 * statt sechs kommen später).
 *
 * Reine Funktionen ohne Zugriff auf Spielstand oder Netz.
 */

export const KADER_TOP_ANZAHL = 6;
export const FEHLPLATZ_WERT = 20;

export type StaerkeSpieler = {
  playerId: string;
  teamId: string;
  ratings: Record<string, number | null | undefined> | null | undefined;
};

export type LigaStaerken = Record<string, Record<string, number>>;

export function berechneStaerke(werte: readonly number[], top = KADER_TOP_ANZAHL): number {
  const beste = [...werte].sort((a, b) => b - a).slice(0, top);
  while (beste.length < top) beste.push(FEHLPLATZ_WERT);
  return beste.reduce((summe, wert) => summe + wert, 0) / top;
}

function werteImTeam(
  spieler: readonly StaerkeSpieler[],
  teamId: string,
  disziplinId: string,
  ausgeschlossen: ReadonlySet<string>,
  ohne?: string,
): number[] {
  const werte: number[] = [];
  for (const eintrag of spieler) {
    if (eintrag.teamId !== teamId || eintrag.playerId === ohne || ausgeschlossen.has(eintrag.playerId)) continue;
    const wert = eintrag.ratings?.[disziplinId];
    if (typeof wert === "number" && Number.isFinite(wert)) werte.push(wert);
  }
  return werte;
}

/** Stärke je Team und Disziplin. `ausgeschlossen` = verletzte Spieler (nicht einsetzbar). */
export function baueLigaStaerken(input: {
  spieler: readonly StaerkeSpieler[];
  teamIds: readonly string[];
  disziplinIds: readonly string[];
  ausgeschlossen?: ReadonlySet<string>;
}): LigaStaerken {
  const ausgeschlossen = input.ausgeschlossen ?? new Set<string>();
  const ergebnis: LigaStaerken = {};
  for (const teamId of input.teamIds) {
    const zeile: Record<string, number> = {};
    for (const disziplinId of input.disziplinIds) {
      zeile[disziplinId] = berechneStaerke(werteImTeam(input.spieler, teamId, disziplinId, ausgeschlossen));
    }
    ergebnis[teamId] = zeile;
  }
  return ergebnis;
}

/** Rang eines Stärkewerts gegen die ANDEREN Teams der Liga (1 = bestes Team). */
export function rangGegenLiga(staerken: LigaStaerken, eigenesTeamId: string, disziplinId: string, wert: number): number {
  let besser = 0;
  for (const [teamId, zeile] of Object.entries(staerken)) {
    if (teamId === eigenesTeamId) continue;
    if ((zeile[disziplinId] ?? FEHLPLATZ_WERT) > wert) besser += 1;
  }
  return 1 + besser;
}

export type RangWirkung = {
  disziplinId: string;
  /** Rang heute. */
  vorher: number;
  /** Bester und schlechtester Rang nach dem Zugang bzw. Abgang (bei exakter Eignung gleich). */
  nachherBest: number;
  nachherSchlecht: number;
  staerkeVorher: number;
  staerkeNachherMitte: number;
};

export type KandidatRange = { von: number; mitte: number; bis: number };

/** Werte des eigenen Teams je Disziplin, einmal sortiert: macht jede Kandidatenrechnung O(6 + Teams). */
export type TeamVorbereitung = {
  teamId: string;
  staerken: LigaStaerken;
  werte: Record<string, number[]>;
};

export function bereiteTeamVor(input: {
  spieler: readonly StaerkeSpieler[];
  staerken: LigaStaerken;
  teamId: string;
  disziplinIds: readonly string[];
  ausgeschlossen?: ReadonlySet<string>;
}): TeamVorbereitung {
  const ausgeschlossen = input.ausgeschlossen ?? new Set<string>();
  const werte: Record<string, number[]> = {};
  for (const disziplinId of input.disziplinIds) {
    werte[disziplinId] = werteImTeam(input.spieler, input.teamId, disziplinId, ausgeschlossen).sort((a, b) => b - a);
  }
  return { teamId: input.teamId, staerken: input.staerken, werte };
}

function staerkeMit(sortiert: readonly number[], zusatz: number): number {
  const beste = sortiert.slice(0, KADER_TOP_ANZAHL);
  beste.push(zusatz);
  return berechneStaerke(beste);
}

/** Wirkung eines ZUGANGS: Stärke mit dem Kandidaten (als Spanne, wenn unscharf). */
export function wirkungMitKandidat(
  vorbereitung: TeamVorbereitung,
  disziplinId: string,
  kandidat: KandidatRange | null,
): RangWirkung {
  const eigene = vorbereitung.werte[disziplinId] ?? [];
  const vorherStaerke = berechneStaerke(eigene);
  const vorher = rangGegenLiga(vorbereitung.staerken, vorbereitung.teamId, disziplinId, vorherStaerke);
  if (!kandidat) {
    return { disziplinId, vorher, nachherBest: vorher, nachherSchlecht: vorher, staerkeVorher: vorherStaerke, staerkeNachherMitte: vorherStaerke };
  }
  return {
    disziplinId,
    vorher,
    nachherBest: rangGegenLiga(vorbereitung.staerken, vorbereitung.teamId, disziplinId, staerkeMit(eigene, kandidat.bis)),
    nachherSchlecht: rangGegenLiga(vorbereitung.staerken, vorbereitung.teamId, disziplinId, staerkeMit(eigene, kandidat.von)),
    staerkeVorher: vorherStaerke,
    staerkeNachherMitte: staerkeMit(eigene, kandidat.mitte),
  };
}

/** Wirkung eines ABGANGS (Verkauf): Stärke ohne den Spieler. Eigene Spieler sind voll bekannt, keine Spanne. */
export function wirkungOhneSpieler(input: {
  spieler: readonly StaerkeSpieler[];
  staerken: LigaStaerken;
  teamId: string;
  disziplinId: string;
  playerId: string;
  ausgeschlossen?: ReadonlySet<string>;
}): RangWirkung {
  const ausgeschlossen = input.ausgeschlossen ?? new Set<string>();
  const alle = werteImTeam(input.spieler, input.teamId, input.disziplinId, ausgeschlossen);
  const ohne = werteImTeam(input.spieler, input.teamId, input.disziplinId, ausgeschlossen, input.playerId);
  const vorherStaerke = berechneStaerke(alle);
  const nachherStaerke = berechneStaerke(ohne);
  const vorher = rangGegenLiga(input.staerken, input.teamId, input.disziplinId, vorherStaerke);
  const nachher = rangGegenLiga(input.staerken, input.teamId, input.disziplinId, nachherStaerke);
  return {
    disziplinId: input.disziplinId,
    vorher,
    nachherBest: nachher,
    nachherSchlecht: nachher,
    staerkeVorher: vorherStaerke,
    staerkeNachherMitte: nachherStaerke,
  };
}

/** In wie vielen Disziplinen hält der Spieler den Kaderrang (sein Abgang würde ihn verschlechtern)? */
export function stammInDisziplinen(input: {
  spieler: readonly StaerkeSpieler[];
  staerken: LigaStaerken;
  teamId: string;
  disziplinIds: readonly string[];
  playerId: string;
  ausgeschlossen?: ReadonlySet<string>;
}): number {
  let anzahl = 0;
  for (const disziplinId of input.disziplinIds) {
    const wirkung = wirkungOhneSpieler({ ...input, disziplinId });
    if (wirkung.nachherBest > wirkung.vorher) anzahl += 1;
  }
  return anzahl;
}

/** Zahl der Disziplinen, in denen der Kandidat den Rang heben KÖNNTE (obere Spannengrenze). */
export function hebtInDisziplinen(wirkungen: readonly RangWirkung[]): number {
  return wirkungen.filter((wirkung) => wirkung.nachherBest < wirkung.vorher).length;
}
