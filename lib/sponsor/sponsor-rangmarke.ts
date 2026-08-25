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
 * in sponsor-offer-presenter.ts: Top 28 / 24 / 20 / 16 / 12 / 8 / 4 / Meister). Eine zweite Skala
 * daneben waere genau die Sorte Doppelbegriff, an der dieses System schon einmal unuebersichtlich
 * geworden ist.
 */
import type { GameState, SponsorLeihgabeRecord } from "@/lib/data/olyDataTypes";

/**
 * Die Bloecke der Sponsor-Rangleiter, von unten nach oben. Bewusst als eigene Konstante und nicht
 * als Import aus dem Presenter: der Presenter haengt an der Anzeige, diese Datei an der Regel.
 * `tests/sponsor-rangmarke.test.ts` haelt beide auf derselben Liste.
 */
export const RANGMARKEN_BLOECKE = [28, 24, 20, 16, 12, 8, 4, 1] as const;

export type RangmarkenHaerte = "mild" | "hart";

/**
 * Der Block, in dem ein Startrang liegt — die ENGSTE Sprosse, die ihn noch enthaelt.
 *
 * Achtung auf die Leserichtung: die Liste steht von der weitesten zur engsten Sprosse (28 → 1),
 * also aufsteigend in der GUETE und absteigend in der ZAHL. Gesucht ist die kleinste Zahl, die den
 * Rang noch fasst — deshalb wird von hinten gelesen. Von vorne gelesen bekaeme der Meister „Top 28".
 */
export function blockFuerRang(rang: number, leagueSize: number = 32): number {
  const geklammert = Math.max(1, Math.min(leagueSize, Math.round(rang)));
  for (let index = RANGMARKEN_BLOECKE.length - 1; index >= 0; index -= 1) {
    const block = RANGMARKEN_BLOECKE[index]!;
    if (geklammert <= block) return block;
  }
  return RANGMARKEN_BLOECKE[0]!;
}

/**
 * DIE MARKE EINES VERTRAGS, bei Unterschrift einzufrieren.
 *
 * `hart` setzt den eigenen Startblock — wer im Block bleibt, behaelt das Gebäude. `mild` setzt
 * einen Block DARUNTER; das ist die Karte, die man auch mit einem mittelmaessigen Jahr haelt.
 *
 * Ein Team aus dem untersten Block bekommt gar keine Marke (Rueckgabe 32): unter „Top 28" gibt es
 * keine Sprosse mehr, und eine Marke, die niemand reissen kann, ist keine — aber sie darf auch
 * nicht dazu fuehren, dass ausgerechnet das schwaechste Team seine Leihe nie nutzen kann.
 */
export function baueRangmarke(input: { startRang: number; haerte: RangmarkenHaerte; leagueSize?: number }): number {
  const leagueSize = input.leagueSize ?? 32;
  const block = blockFuerRang(input.startRang, leagueSize);
  if (input.haerte === "hart") return block;
  const index = RANGMARKEN_BLOECKE.indexOf(block as (typeof RANGMARKEN_BLOECKE)[number]);
  // Ein Block weiter unten heisst: groessere Zahl. Im untersten Block gibt es keinen mehr, dann
  // deckt die Marke die ganze Tabelle ab.
  return index <= 0 ? leagueSize : RANGMARKEN_BLOECKE[index - 1]!;
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
