/**
 * SPONSOR-OEKONOMIE — was von der Kalibrierungsschicht uebrig ist.
 *
 * Diese Datei war der Sitz der alten Auszahlungsmathematik: gehaltsgeankerter Sockel,
 * Meilenstein-Leiter, Archetyp- und Rarity-Etat-Multiplikatoren, Golden-Rang-Boost,
 * `teamQualityRank`-Rebalance, Korridor- und Anker-Elevations-Kompression. Mit dem V3-Umbau
 * ("Preisgeld-Sockel", docs/SPONSOR_PREISGELD_SOCKEL_ENTWURF.md, Abschnitt 4) ist all das
 * ERSATZLOS ENTFALLEN: die Sponsorleiter IST jetzt die Preisgeld-Benchmark-Leiter, einmal um den
 * teameigenen Erwartungsanker getiltet. Es gibt keine zweite Kurve mehr, die kalibriert werden
 * muesste, und damit auch nichts mehr zu kalibrieren.
 *
 * Geblieben sind drei Dinge, die nichts mit der alten Mathematik zu tun hatten: der Ligajahr-Faktor,
 * das Lesen einer eingefrorenen Leiter und die beiden Umschaltstellen, an denen Anzeige und
 * KI-Bewertung die Konditionen eines Angebots abfragen.
 */
import type { GameState, SponsorOffer } from "@/lib/data/olyDataTypes";
import {
  getSponsorV3Terms,
  sponsorV3ExpectedPayout,
  sponsorV3GuaranteedLadder,
} from "@/lib/sponsor/sponsor-v3-offer-service";

/**
 * ABSOLUTE UNTERGRENZE der Sponsor-Oekonomie. Sie ist als Sicherheitsnetz geblieben (Guardrail aus
 * Abschnitt 4 des Entwurfs) und wird zusaetzlich vom Gebaeude-Katalog als Bezugsgroesse gelesen.
 * Die Kartenboeden liegen typisch bei 41-57 C; sie bindet praktisch nie.
 */
export const SPONSOR_BASE_FLOOR_C = 32;

export { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";

/**
 * Salary-Factor der laufenden Saison. Single Source fuer Offer-/Settlement-Pfad UND die
 * Anzeige-Leiter.
 */
export function getCurrentSponsorSalaryFactor(gameState: GameState): number {
  const factor = gameState.seasonState.seasonEconomyFactors?.[0]?.factor;
  return typeof factor === "number" && Number.isFinite(factor) && factor > 0 ? factor : 1;
}

/** Liest eine eingefrorene Leiter am erreichten Endrang (geklammert 1..32); `null` ⇒ Rang 32 (Sockel). */
export function readLockedRankPayout(ladder: number[], finalRank: number | null | undefined): number {
  if (ladder.length === 0) {
    return 0;
  }
  if (finalRank == null || !Number.isFinite(finalRank)) {
    return ladder[ladder.length - 1] ?? 0;
  }
  const boundedRank = Math.min(32, Math.max(1, Math.round(finalRank)));
  return ladder[boundedRank - 1] ?? ladder[ladder.length - 1] ?? 0;
}

/**
 * DIE UMSCHALTSTELLE DER ANZEIGE. Diese eine Funktion liefert sowohl die in der Karte angezeigten
 * Gewinnstufen als auch die beim Unterschreiben eingefrorene Leiter — deshalb gibt es keine zweite
 * Sign-Logik daneben, die auseinanderdriften koennte.
 *
 * Ein Angebot ohne V3-Konditionen kann es nur in einem Spielstand geben, dessen Angebote noch nicht
 * neu erzeugt wurden (`ensureSeasonSponsorOffers` ersetzt sie beim naechsten Durchgang). Bis dahin
 * liefert die Funktion eine leere Leiter, statt eine erfundene Kurve zu zeigen.
 */
export function buildOfferRankPayoutLadderPreview(_gameState: GameState, offer: SponsorOffer): number[] {
  const terms = getSponsorV3Terms(offer);
  return terms ? sponsorV3GuaranteedLadder(terms) : [];
}

/**
 * Erwartungswert eines Angebots fuer die KI-Bewertung und die Kartenanzeige.
 *
 * In V3 ist er per Konstruktion fuer ALLE Karten eines Slates derselbe — genau das ist die zentrale
 * Zusage des Entwurfs. Die Funktion bleibt trotzdem, weil Anzeige und Finanzprognose eine Zahl
 * brauchen; sie rechnet sie aus der eingefrorenen Leiter zurueck statt sie irgendwo abzuschreiben.
 */
export function estimateExpectedPayout(offer: SponsorOffer, _powerRank?: number | null): number {
  const terms = getSponsorV3Terms(offer);
  if (!terms) return 0;
  return Math.round(sponsorV3ExpectedPayout(terms) * 10) / 10;
}
