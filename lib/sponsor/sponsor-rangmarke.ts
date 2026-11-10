/**
 * DIE RANGMARKE — „über Platz X bleiben", und der Grund, warum eine Gebäude-Karte ein Risiko ist.
 *
 * Ohne sie waere die Leihe ein reiner Tausch: fester Verzicht gegen festes Gebäude, keine
 * Entscheidung, nur Arithmetik. Die Marke macht das Gebäude BEDINGT, während der Verzicht fest
 * bleibt — Chris: „die Rangmarke macht ihn bedingt, waehrend der Verzicht fest bleibt."
 *
 * DIE DREI REGELN, alle aus Abschnitt 4.4 der Bauvorlage:
 *
 *   1. DIE MARKE IST RELATIV ZUM STARTBLOCK, nie darueber. Eine Marke oberhalb des eigenen
 *      Startblocks waere die alte Zielfalle: ein Vertrag, den man nur mit einem Sprung nach oben
 *      haelt. Grosse Karten setzen den eigenen Startblock, kleine einen Block darunter.
 *   2. GELD IST NIE BETROFFEN. Die Leiter zahlt unveraendert, der Verzicht laeuft fix weiter. Der
 *      Sponsor stellt bereit, das Nutzungsrisiko traegt der Spieler. Nur so bleibt die Auszahlung
 *      planbar (Invariante 1) und die Karte ehrlich — der Preis steht als EINE feste Zahl darauf.
 *   3. SOFORT AUS, SOFORT WIEDER AN, nichts rueckwirkend. Spieltagsnahe Wirkungen setzen aus,
 *      saisonweite zaehlen anteilig nach aktiven Spieltagen (aktiv an 8 von 10 = 80 %).
 *
 * Die Bloecke sind dieselben, die die Sponsor-Rangleiter ohnehin zeigt (`SPONSOR_RANK_LADDER_RUNGS`
 * in sponsor-offer-presenter.ts baut seine Sprossen aus `sponsorRangBloecke` hier). Eine zweite
 * Skala daneben waere genau die Sorte Doppelbegriff, an der dieses System schon einmal
 * unuebersichtlich geworden ist.
 */
import type { GameState, SponsorLeihgabeRecord } from "@/lib/data/olyDataTypes";
import { LEAGUE_SIZE, TEAM_COUNT_TOTAL, isLeagueSplitActive } from "@/lib/season/league-split";

/**
 * Wie viele Sprossen die Leiter unter „Meister" hat. Die Schrittweite ist `leagueSize / 8`:
 * bei einer 16er-Liga alle 2 Plaetze eine Stufe (Chris, 10.11.: „dann sollte es für alle 2 plätze
 * mehr cash geben statt alle 4"), im Legacy-32er-Modus wie bisher alle 4.
 */
const SPONSOR_RANG_STUFEN = 8;

/**
 * DIE BLOECKE DER SPONSOR-RANGLEITER fuer einen Rangraum von `leagueSize` Plaetzen, von unten nach
 * oben (weiteste Sprosse zuerst, „Meister" = 1 zuletzt).
 *
 *   leagueSize 16 → [14, 12, 10, 8, 6, 4, 2, 1]
 *   leagueSize 32 → [28, 24, 20, 16, 12, 8, 4, 1]   (bit-identisch zur frueheren festen Liste)
 *
 * Der letzte Platz selbst ist keine Sprosse — er ist der garantierte Boden
 * (`SPONSOR_RANK_FLOOR_AT` im Presenter).
 */
export function sponsorRangBloecke(leagueSize: number = LEAGUE_SIZE): number[] {
  const groesse = Math.max(2, Math.round(Number.isFinite(leagueSize) ? leagueSize : LEAGUE_SIZE));
  const schritt = Math.max(1, Math.floor(groesse / SPONSOR_RANG_STUFEN));
  const bloecke: number[] = [];
  for (let stufe = SPONSOR_RANG_STUFEN - 1; stufe >= 1; stufe -= 1) {
    const block = stufe * schritt;
    if (block > 1 && block < groesse && !bloecke.includes(block)) bloecke.push(block);
  }
  bloecke.push(1);
  return bloecke;
}

/**
 * DER RANGRAUM, IN DEM DIESER SPIELSTAND ABRECHNET: liga-lokal `LEAGUE_SIZE` (16), sobald der
 * Liga-Split aktiv ist — Tabellenplatz und damit Sponsor-Endrang zaehlen dann 1..16 —, sonst der
 * Legacy-32er-Modus (`TEAM_COUNT_TOTAL`) alter Spielstaende ohne Liga-Zuordnung. Ohne Spielstand
 * gilt die heutige Ligagroesse.
 */
export function sponsorRangraumFuer(gameState: Pick<GameState, "seasonState"> | null | undefined): number {
  if (!gameState?.seasonState) return LEAGUE_SIZE;
  return isLeagueSplitActive(gameState as GameState) ? LEAGUE_SIZE : TEAM_COUNT_TOTAL;
}

/**
 * Die Bloecke bei der heutigen Ligagroesse (`LEAGUE_SIZE`). Abgeleitet, nicht gepflegt:
 * `tests/sponsor-rangmarke.test.ts` haelt sie auf derselben Liste wie die Presenter-Leiter.
 */
export const RANGMARKEN_BLOECKE: readonly number[] = sponsorRangBloecke(LEAGUE_SIZE);

export type RangmarkenHaerte = "mild" | "hart";

/**
 * Der Block, in dem ein Startrang liegt — die ENGSTE Sprosse, die ihn noch enthaelt.
 *
 * Achtung auf die Leserichtung: die Liste steht von der weitesten zur engsten Sprosse (14 → 1),
 * also aufsteigend in der GUETE und absteigend in der ZAHL. Gesucht ist die kleinste Zahl, die den
 * Rang noch fasst — deshalb wird von hinten gelesen. Von vorne gelesen bekaeme der Meister „Top 14".
 *
 * `leagueSize` ist der Rangraum des Spielstands (`sponsorRangraumFuer`), Default die heutige
 * Ligagroesse `LEAGUE_SIZE`.
 */
export function blockFuerRang(rang: number, leagueSize: number = LEAGUE_SIZE): number {
  const bloecke = sponsorRangBloecke(leagueSize);
  const geklammert = Math.max(1, Math.min(leagueSize, Math.round(rang)));
  for (let index = bloecke.length - 1; index >= 0; index -= 1) {
    const block = bloecke[index]!;
    if (geklammert <= block) return block;
  }
  return bloecke[0]!;
}

/**
 * DIE MARKE EINES VERTRAGS, bei Unterschrift einzufrieren.
 *
 * `hart` setzt den eigenen Startblock — wer im Block bleibt, behaelt das Gebäude. `mild` setzt
 * einen Block DARUNTER; das ist die Karte, die man auch mit einem mittelmaessigen Jahr haelt.
 *
 * Ein Team aus dem untersten Block bekommt gar keine Marke (Rueckgabe `leagueSize`, also der letzte
 * Platz): unter der weitesten Sprosse („Top 14" bei 16 Teams) gibt es keine mehr, und eine Marke,
 * die niemand reissen kann, ist keine — aber sie darf auch nicht dazu fuehren, dass ausgerechnet das
 * schwaechste Team seine Leihe nie nutzen kann.
 */
export function baueRangmarke(input: { startRang: number; haerte: RangmarkenHaerte; leagueSize?: number }): number {
  const leagueSize = input.leagueSize ?? LEAGUE_SIZE;
  const bloecke = sponsorRangBloecke(leagueSize);
  const block = blockFuerRang(input.startRang, leagueSize);
  if (input.haerte === "hart") return block;
  const index = bloecke.indexOf(block);
  // Ein Block weiter unten heisst: groessere Zahl. Im untersten Block gibt es keinen mehr, dann
  // deckt die Marke die ganze Tabelle ab.
  return index <= 0 ? leagueSize : bloecke[index - 1]!;
}

/** Haelt dieses Team seine Marke gerade? */
export function marktGehalten(input: { aktuellerRang: number | null | undefined; marke: number }): boolean {
  if (input.aktuellerRang == null || !Number.isFinite(input.aktuellerRang)) return true;
  return input.aktuellerRang <= input.marke;
}

/**
 * Schaltet die Leihgaben eines Teams nach dem aktuellen Tabellenplatz scharf oder ab.
 *
 * Reine Funktion auf der Liste: sie entscheidet nur ueber `ruht`, fasst weder Stufe noch Zustand an
 * und erzeugt keine neue Liste, wenn sich nichts aendert — der Aufrufer kann also am
 * Referenzvergleich erkennen, ob ueberhaupt etwas passiert ist.
 */
export function schalteLeihgaben(input: {
  leihgaben: readonly SponsorLeihgabeRecord[];
  aktuellerRang: number | null | undefined;
  marke: number;
}): SponsorLeihgabeRecord[] {
  const gehalten = marktGehalten({ aktuellerRang: input.aktuellerRang, marke: input.marke });
  let geaendert = false;
  const naechste = input.leihgaben.map((leihgabe) => {
    const sollRuhen = !gehalten;
    if ((leihgabe.ruht === true) === sollRuhen) return leihgabe;
    geaendert = true;
    return sollRuhen ? { ...leihgabe, ruht: true } : { ...leihgabe, ruht: undefined };
  });
  return geaendert ? naechste : (input.leihgaben as SponsorLeihgabeRecord[]);
}

/**
 * DIE ANTEILIGE SAISONWIRKUNG. Spieltagsnahe Effekte schalten sich selbst ab, weil sie am Spieltag
 * das ruhende Gebäude gar nicht erst sehen. Saisonweite Effekte (Trainingsprogression, Academy)
 * werden dagegen EINMAL am Saisonende gerechnet und wuessten sonst nichts davon, dass das Gebäude
 * die halbe Saison stillstand.
 *
 * `aktiveSpieltage / gesamtSpieltage`, geklammert auf 0..1. Ohne gelaufene Spieltage gilt volle
 * Wirkung — sonst waere die Vorsaison-Rechnung eine Division durch Null.
 */
export function anteiligeSaisonwirkung(input: { aktiveSpieltage: number; gesamtSpieltage: number }): number {
  if (!Number.isFinite(input.gesamtSpieltage) || input.gesamtSpieltage <= 0) return 1;
  const anteil = input.aktiveSpieltage / input.gesamtSpieltage;
  return Math.max(0, Math.min(1, anteil));
}

/** Anzeigehilfe: „aktiv" oder „ruht — 3 Plätze unter der Marke". */
export function beschreibeRangmarke(input: {
  aktuellerRang: number | null | undefined;
  marke: number;
}): string {
  if (input.aktuellerRang == null) return `Marke: Top ${input.marke}`;
  if (marktGehalten(input)) return `aktiv · Platz ${input.aktuellerRang} von Top ${input.marke}`;
  const abstand = input.aktuellerRang - input.marke;
  return `ruht · ${abstand} ${abstand === 1 ? "Platz" : "Plätze"} unter der Marke (Top ${input.marke})`;
}

/**
 * DER EINE AUFRUF FUER DEN GANZEN SPIELSTAND: nach jedem gewerteten Spieltag pruefen, welche
 * Leihgaben noch wirken.
 *
 * Sitzt am Ende von `standings-apply-service` — direkt dort, wo der Tabellenplatz entsteht. Jede
 * andere Stelle waere entweder zu frueh (alter Rang) oder zu spaet (das Gebäude haette einen
 * Spieltag zu lang gewirkt).
 *
 * Gibt den Spielstand UNVERAENDERT zurueck, wenn sich nichts aendert — das ist die Bedingung
 * dafuer, dass ein Save ohne Leihgaben von diesem Schritt gar nichts merkt.
 */
export function schalteAlleLeihgabenNachTabelle(gameState: GameState): GameState {
  const alle = gameState.seasonState?.sponsorLeihgabenByTeamId;
  if (!alle || Object.keys(alle).length === 0) return gameState;

  const vertraege = gameState.seasonState.sponsorContractsByTeamId ?? {};
  const standings = gameState.seasonState.standings ?? {};
  let geaendert = false;
  const naechste: Record<string, SponsorLeihgabeRecord[]> = {};

  for (const [teamId, leihgaben] of Object.entries(alle)) {
    const marke = vertraege[teamId]?.sponsorLeihe?.rangmarke;
    if (marke == null || !leihgaben || leihgaben.length === 0) {
      naechste[teamId] = leihgaben ?? [];
      continue;
    }
    const geschaltet = schalteLeihgaben({
      leihgaben,
      aktuellerRang: standings[teamId]?.rank ?? null,
      marke,
    });
    if (geschaltet !== leihgaben) geaendert = true;
    naechste[teamId] = geschaltet;
  }

  if (!geaendert) return gameState;
  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, sponsorLeihgabenByTeamId: naechste },
  };
}
