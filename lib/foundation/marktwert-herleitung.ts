/**
 * WIE DER MARKTWERT EINES SPIELERS ZUSTANDE KOMMT — die Zerlegung hinter dem Hover.
 *
 * GEWUENSCHT VON CHRIS am 23.08.2026 als Punkt 6 der Hover-Liste. Beim ersten Vorschlag hatte ich
 * behauptet, `player-economy-compare-service.ts` „habe die Bestandteile schon" — das war falsch,
 * das ist ein Vergleichs-Report (Legacy gegen berechnet), keine Zerlegung. Die echte Zerlegung
 * liegt woanders und wurde bisher weggeworfen.
 *
 * DIE RECHNUNG. `calculateMarketValueFromRankTable` rankt jeden Spieler in JEDER Disziplin gegen
 * die ganze Liga, schlaegt den Rang in `rank-to-discipline-market-value.json` nach und summiert die
 * Teilwerte. `mwChangeFix` kommt oben drauf, negative Summen werden auf 0 gehoben. Genau diese
 * Summe steht als Marktwert im Spiel — und genau die Teile davon wirft
 * `computeLeagueMarketValueMapFromPlayers` weg, weil es nur `marketValueNew` behaelt.
 *
 * AM LIVE-ABBILD VOM 23.08. NACHGEMESSEN, ueber alle sieben Spielstaende und je 2984 Spieler:
 * die Summe der Rangbeitraege trifft den im Spiel gezeigten Marktwert
 * (`resolvePlayerEconomyContract`) auf hoechstens 0,01 genau — 0 Abweichungen ueber 0,05.
 * Der Hover erklaert also die Zahl, die danebensteht, und nicht eine zweite, aehnliche.
 *
 * WARUM NUR FUENF ZEILEN. Ein Spieler wird in 20 Disziplinen gerankt, und alle 20 tragen bei
 * (gemessen: 20 von 20 bei jedem geprueften Spieler). Zwanzig Zeilen sind kein Hover mehr. Gezeigt
 * werden die fuenf groessten Beitraege, der Rest als EINE Summenzeile — dieselbe Regel wie bei den
 * Saisonstand-Hovers (`SAISONSTAND_HOVER_MAX_ZEILEN`).
 *
 * WARUM DIE ABLEITUNG AUF DEM SERVER LAEUFT. Die Rangtabelle ist 222 KB gross und heute in keinem
 * Client-Bundle. Sie fuer einen Hover hineinzuziehen waere ein schlechter Tausch; eine gekuerzte
 * Fassung waere schlimmer, weil sie eine ZWEITE, leicht andere Zahl ergaebe. Die Zerlegung kommt
 * deshalb fertig aus dem Player-Directory-Slice — derselbe Weg und dieselbe Begruendung wie beim
 * Verkaufswert eine Feldbeschreibung weiter.
 */
import type { MarketValueFixtureResult } from "@/lib/player-formulas/player-formula-types";

/** Wie viele Disziplinzeilen der Hover einzeln zeigt, bevor der Rest zu einer Summe wird. */
export const MARKTWERT_HOVER_MAX_ZEILEN = 5;

export type MarktwertHoverZeile = {
  disciplineId: string;
  /** Rang des Spielers in dieser Disziplin, ligaweit. */
  rank: number;
  /** Was dieser Rang laut Tabelle wert ist. */
  amount: number;
};

export type MarktwertHerleitung = {
  /** Die groessten Einzelbeitraege, absteigend. Hoechstens `MARKTWERT_HOVER_MAX_ZEILEN`. */
  zeilen: MarktwertHoverZeile[];
  /** Wie viele Disziplinen NICHT einzeln stehen. 0, wenn alle gezeigt werden. */
  restAnzahl: number;
  /**
   * Was auf der Sammelzeile steht — `summeRaenge` MINUS den gerundeten gezeigten Zeilen, nicht die
   * roh aufaddierte Restsumme. Der Unterschied sind Rundungscents, und er entscheidet, ob die
   * Spalte im Hover aufgeht: nur so ergeben die sechs sichtbaren Zahlen zusammen exakt die Summe,
   * die eine Zeile tiefer steht. Eine Zerlegung, die sich selbst um einen Cent verfehlt, laedt
   * genau die Rueckfrage ein, die sie beantworten soll.
   */
  restSumme: number;
  /** Summe ueber ALLE Disziplinen — vor `mwChangeFix`. */
  summeRaenge: number;
  /**
   * Handkorrektur aus dem Spielstand. `null`, wenn keine gesetzt ist — dann faellt die Zeile weg,
   * statt eine 0 zu zeigen, die wie eine Aussage aussieht.
   */
  mwChangeFix: number | null;
  /** Der Marktwert selbst — die Zahl, an der der Hover haengt. */
  marktwert: number;
};

function runde(wert: number): number {
  return Number(wert.toFixed(2));
}

/**
 * Baut die Zerlegung aus dem Ergebnis der Marktwert-Engine.
 *
 * Gibt `null` zurueck, wenn keine einzige Disziplin einen Beitrag traegt. Das ist kein Fehlerfall
 * — ein Spieler ohne gewertete Disziplin hat keinen aus Raengen gebauten Marktwert, und dann ist
 * ein leerer Hover ehrlicher als eine Zeile „0,00".
 */
export function buildMarktwertHerleitung(fixture: MarketValueFixtureResult): MarktwertHerleitung | null {
  const beitraege = Object.entries(fixture.disciplineMarketValues)
    .map(([disciplineId, amount]) => ({
      disciplineId,
      amount,
      rank: fixture.disciplineRanks[disciplineId] ?? null,
    }))
    .filter((eintrag): eintrag is MarktwertHoverZeile => eintrag.rank != null)
    .sort((links, rechts) => rechts.amount - links.amount || links.disciplineId.localeCompare(rechts.disciplineId));

  if (beitraege.length === 0) {
    return null;
  }

  // Auf zwei Stellen gerundet UEBERTRAGEN, nicht erst in der Anzeige: die Tabelle fuehrt drei
  // Stellen (5.245), gezeigt werden zwei — und was gezeigt wird, muss auch das sein, womit die
  // Sammelzeile rechnet.
  const zeilen = beitraege
    .slice(0, MARKTWERT_HOVER_MAX_ZEILEN)
    .map((eintrag) => ({ ...eintrag, amount: runde(eintrag.amount) }));
  const restAnzahl = Math.max(0, beitraege.length - zeilen.length);
  // `rawDisciplineMarketValueSum` kommt aus der Engine und ist die Summe VOR der Handkorrektur.
  // Bewusst von dort und nicht selbst aufaddiert: sonst stuende die Rechnung zweimal im Code.
  const summeRaenge = fixture.rawDisciplineMarketValueSum;
  const korrektur = runde(fixture.adjustedRaw - fixture.rawDisciplineMarketValueSum);

  return {
    zeilen,
    restAnzahl,
    restSumme: restAnzahl === 0 ? 0 : runde(summeRaenge - zeilen.reduce((summe, zeile) => summe + zeile.amount, 0)),
    summeRaenge,
    mwChangeFix: korrektur === 0 ? null : korrektur,
    marktwert: fixture.marketValueNew,
  };
}
