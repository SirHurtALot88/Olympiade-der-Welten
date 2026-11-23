/**
 * FINANZEN JE SPIELTAG — die ERWARTETE Buchung eines Spieltags (22.11.), nur fuer Anzeige und Prognose der Finanzseite.
 * Client-sicher: rechnet aus dem heutigen Stand (Kadergehalt, Sponsor-Basis, Gebaeude) Jahresbetrag / N, ohne Rundungsrest.
 * Gebucht wird in `finanzen-je-spieltag-buchung.ts`; dort gelten dieselben Jahresbetraege, nur gerundet und mit Rest.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { computeFacilitySeasonCash } from "@/lib/finance/season-end-guv";
import { kaderJahresgehaltAmSpieltag, spieltageDerSaison } from "@/lib/finance/finanzen-je-spieltag";
import { marketingJahresbetrag } from "@/lib/marketing/marketing-team";
import { sponsorBasisJahr, sponsorRangAbschlag, sponsorRangFuerAbschlag } from "@/lib/sponsor/sponsor-settlement-service";

export type ErwarteteSpieltagBuchung = {
  gehalt: number;
  sponsorBasis: number;
  gebaeudeEinnahme: number;
  gebaeudeUnterhalt: number;
  /** Rang-Abschlag beim aktuellen Tabellenplatz (22.11.). */
  rangAbschlag: number;
  /** Marketing: Teammarke + Team-Anteile (22.11.), 0 ohne gueltige Regel. */
  marketing: number;
  netto: number;
};

/** Vorzeichen wie im Ledger (Gehalt und Unterhalt negativ). */
export function erwarteteSpieltagBuchung(gameState: GameState, teamId: string): ErwarteteSpieltagBuchung {
  const n = spieltageDerSaison(gameState);
  const teil = (x: number) => (n > 0 ? x / n : 0);
  const gebaeude = computeFacilitySeasonCash(gameState, teamId, null);
  const gehalt = -teil(kaderJahresgehaltAmSpieltag(gameState, teamId, null));
  const sponsorBasis = teil(sponsorBasisJahr(gameState, teamId));
  const gebaeudeEinnahme = teil(gebaeude.income);
  const gebaeudeUnterhalt = -teil(gebaeude.paidUpkeep);
  // Offene Spieltage laufen mit dem aktuellen Platz weiter (gleiche Rechnung wie die Buchung).
  const rangAbschlag = sponsorRangAbschlag(gameState, teamId, sponsorRangFuerAbschlag(gameState, teamId), n).abschlag;
  const marketing = teil(marketingJahresbetrag(gameState, teamId));
  return {
    gehalt, sponsorBasis, gebaeudeEinnahme, gebaeudeUnterhalt, rangAbschlag, marketing,
    netto: gehalt + sponsorBasis + gebaeudeEinnahme + gebaeudeUnterhalt + rangAbschlag + marketing,
  };
}
