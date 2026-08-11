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
import type { GameState, SponsorOffer, SponsorTermSeasons } from "@/lib/data/olyDataTypes";
import {
  getSponsorV3Terms,
  rerollSponsorV3TermsForNewSeason,
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

export type SponsorOfferTermForecastEntry = {
  /** 1-basiertes Vertragsjahr (1 = Unterschriftssaison). */
  seasonYear: number;
  /** Salary Factor, mit dem DIESE Saison gerechnet ist. */
  salaryFactor: number;
  /**
   * Woher der Faktor stammt. `"vorausgewuerfelt"` heisst: er steht als eigener Eintrag im
   * Salary-Factor-Fenster und gilt fuer genau diese Saison. `"fortgeschrieben"` heisst: fuer
   * diese Saison liegt (noch) kein eigener Wert vor, gerechnet wird mit dem bei Unterschrift
   * eingefrorenen Faktor.
   *
   * Der Unterschied ist nicht kosmetisch. In Season 1 ist `seasonEconomyFactors` leer — das
   * Fenster wird erst beim Saisonuebergang geschrieben (preseason-workflow-service.ts). Die Karte
   * zeigte deshalb fuer JEDE Vertragssaison „Faktor 1.00" und behauptete damit drei unabhaengige
   * Prognosen, wo in Wahrheit einmal derselbe Platzhalter stand.
   */
  factorSource: "vorausgewuerfelt" | "fortgeschrieben";
  /** Auszahlung an der AKTUELLEN Tabellenposition (`terms.startRank`) in dieser Vertragssaison. */
  payoutAtCurrentRank: number;
  /**
   * Auszahlungsleiter Rang 1..32 fuer GENAU diese Vertragssaison (Faktor + Laufzeit-Erosion
   * eingerechnet). Damit zeigt der Hover auf eine Saisonzeile, was jeder Rang IN DIESER SAISON
   * bringt — was sich zwischen den Vertragsjahren tatsaechlich unterscheidet.
   */
  rankPayouts: number[];
};

/**
 * AUSBLICK UEBER DIE LAUFZEIT (Umsetzungsplan D, Punkt 4): was der Vertrag bei der AKTUELLEN
 * Tabellenposition in JEDER Saison der Laufzeit einbringen wuerde — Sockel bleibt nach dem bei
 * Unterschrift eingefrorenen Startrang fest, der Wertungsanteil skaliert mit dem fuer diese Saison
 * bereits vorausgewuerfelten Salary Factor (`gameState.seasonState.seasonEconomyFactors`,
 * `SEASON_ECONOMY_FACTOR_WINDOW_SIZE` Saisons im Voraus bekannt — dieselben Zahlen, die
 * `sponsorSupportForecast5` fuer die KI liest, siehe lib/ai/retool-ai2-pick-engine.ts). Keine erfundene
 * Zahl: nur eine bereits vorliegende Information sichtbar gemacht, die dem Spieler heute vorenthalten
 * bleibt.
 *
 * Rein deterministisch aus dem Angebot + der Salary-Factor-Vorausschau — KEIN Zufall, KEINE
 * Spielzustandsmutation.
 */
export function buildSponsorOfferTermForecast(gameState: GameState, offer: SponsorOffer): SponsorOfferTermForecastEntry[] {
  const terms = getSponsorV3Terms(offer);
  if (!terms || !terms.curveShape) {
    return [];
  }
  const termSeasons = offer.termSeasons ?? 1;
  const window = gameState.seasonState.seasonEconomyFactors ?? [];
  const rankIndex = Math.max(0, Math.min(31, Math.round(terms.startRank) - 1));

  return Array.from({ length: termSeasons }, (_, seasonIndex) => {
    const vorausgewuerfelt = window.find((entry) => entry.horizonIndex === seasonIndex)?.factor;
    const hatEigenenFaktor = typeof vorausgewuerfelt === "number" && Number.isFinite(vorausgewuerfelt);
    const factor = hatEigenenFaktor ? vorausgewuerfelt : terms.salaryFactor;
    const contractYear = Math.max(1, Math.min(3, seasonIndex + 1)) as SponsorTermSeasons;

    // DIE VORSCHAU RECHNET NICHT SELBST — sie ruft genau die Funktion, die beim Saisonwechsel
    // tatsaechlich laeuft, und liest deren Leiter ab.
    //
    // WARUM DAS HIER STEHT UND NICHT NUR EIN KOMMENTAR IST: vorher baute diese Funktion die Leiter
    // mit `sponsorKurvenLeiter` NEU und wandte Erosion und Boden von Hand an. Das ging so lange gut,
    // wie zwischen der rohen Ligaleiter und der Vertragsleiter nichts weiter lag. Mit dem
    // Raritaets-Wertfaktor (E10) liegt dort etwas: die Vorschau zeigte fuer eine legendaere Karte
    // exakt 1/1,11 = 90,1 % der Betraege, die die Gewinnstufen-Leiter daneben auswies — auf der
    // GLEICHEN Sprosse standen 57,7 und 64,1. Der Tilt der Karte fehlte ihr ebenfalls schon vorher.
    //
    // Eine zweite Rechenstelle findet solche Abweichungen nie von selbst; sie treibt nur langsam
    // auseinander. Deshalb ist der Weg jetzt derselbe wie in der Wirklichkeit, und ein kuenftiger
    // Regler an der Leiter kann die Vorschau gar nicht mehr vergessen.
    const jahresTerms = rerollSponsorV3TermsForNewSeason(terms, { newSalaryFactor: factor, contractYear });
    const leiter = sponsorV3GuaranteedLadder(jahresTerms);
    const runde = (wert: number) => Math.round(wert * 10) / 10;

    return {
      seasonYear: seasonIndex + 1,
      salaryFactor: factor,
      factorSource: hatEigenenFaktor ? ("vorausgewuerfelt" as const) : ("fortgeschrieben" as const),
      payoutAtCurrentRank: runde(leiter[rankIndex] ?? jahresTerms.floor),
      rankPayouts: leiter.map(runde),
    };
  });
}
