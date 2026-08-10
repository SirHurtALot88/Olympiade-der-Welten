/**
 * "Kredite" (credits/loans) view-model types.
 *
 * UI-facing shape of a human team's credit state, backed by the real bank
 * credit system in `lib/finance/loan-service.ts` (see
 * `docs/design/kredit-system.md`). Game logic (interest math, capacity,
 * cash mutations) lives entirely in the service — this file only describes
 * what the Credits UI needs to render. The offer marketplace itself renders
 * `LoanOffer` (`lib/finance/loan-service.ts`) directly — no UI-local copy of
 * that shape.
 */

import type { EarlyPayoffQuote } from "@/lib/finance/loan-service";

/** A loan the team currently owes money on (mirrors `LoanRecord`, UI-shaped). */
export type ActiveLoan = {
  /** `LoanRecord.loanId`. */
  id: string;
  /** `principalOriginal` — ursprüngliche Kreditsumme. */
  principal: number;
  /** `principalOutstanding` — Restschuld. */
  outstanding: number;
  /** `interestRatePerSeason`, fix bei Abschluss. */
  interestRate: number;
  /** Ursprüngliche Laufzeit in Saisons. */
  termSeasons: number;
  /** `seasonsRemaining` — verbleibende Saisons bis vollständig getilgt. */
  remainingSeasons: number;
  /** `installmentPerSeason` — konstante Jahresrate (Annuität), wird am Saisonende automatisch abgebucht. */
  nextInstalment: number;
  status: "active" | "paid" | "defaulted";
  /** Bank oder Team-Verleiher (Phase 3). */
  lenderType: "bank" | "team";
  /** `LoanRecord.lenderTeamId` — `null` bei Bank-Krediten. */
  lenderTeamId: string | null;
  /** "Bank" oder der Anzeigename des Verleiher-Teams. */
  lenderName: string;
  /** Live-Quote für die "Vorzeitig ablösen"-Aktion, siehe `computeEarlyPayoff`. */
  earlyPayoffQuote: EarlyPayoffQuote;
};

/** Live-berechnetes Angebot für einen noch nicht aufgenommenen Kredit — aktualisiert sich sofort beim Ziehen/Tippen. */
export type LoanQuote = {
  interestRatePerSeason: number;
  installmentPerSeason: number;
  totalRepayment: number;
  totalInterest: number;
};

/** Warum die Kreditaufnahme gerade gesperrt ist (Formular ausgeblendet, Note statt Slider). */
export type CreditBorrowBlockedReason = "not_preseason" | "no_capacity" | "season_one";

/** Ein menschliches Team's Kredit-Gesamtbild — nur das eigene Team (Fog of War). */
export type TeamCreditState = {
  teamId: string;
  /** Zusätzlicher Kreditrahmen (siehe `computeBorrowingCapacity`), bereits abzüglich bestehender Restschuld. */
  creditLimit: number;
  /** Größter Betrag, den irgendein Anbieter (Bank ODER Team) vergibt — Slider-Max & Marktplatz-Gate. Die Bank kann 0 sein, während Teams leihen. */
  maxOfferAmount: number;
  /** Summe aller aktiven Restschulden (`getTeamOutstandingDebt`). */
  outstandingDebt: number;
  /** Aktuelles Cash des Teams. */
  cash: number;
  /** `TeamIdentity.finances` (0–10, Default 5), fließt in Zinssatz & Kapazität ein. */
  finances: number;
  /** Preseason und `creditLimit > 0`. */
  canBorrow: boolean;
  /** Wenn `!canBorrow`: warum (Preseason-Gate, Season-1-Regel vs. ausgeschöpfter Rahmen). */
  borrowBlockedReason: CreditBorrowBlockedReason | null;
  /** Preseason/Verkaufsphase-Gate für "Vorzeitig ablösen" (`credit_early_payoff`), siehe `game-phase-action-policy.ts`. */
  canEarlyPayoff: boolean;
  minTermSeasons: number;
  maxTermSeasons: number;
  activeLoans: ActiveLoan[];
  /**
   * ALLE Kredite der Liga — aktive und beendete, unabhaengig vom eigenen Team. Reine Anzeige,
   * keine Aktionen. Sortiert: laufende zuerst, darin die groesste Restschuld oben.
   */
  leagueLoans: LeagueLoanRow[];

  /**
   * Rohe Bank-Gesamtkapazität (`creditLimit + outstandingDebt`, vor Abzug der
   * Restschuld) — Hero-Gauge-Skala ("Kreditrahmen-Gauge"). 0 wenn beides 0
   * ist (keine Division-durch-0 in der Gauge nötig, siehe dort).
   */
  creditCapacityTotal: number;
  /**
   * Auslastung des Bank-Rahmens (`outstandingDebt / creditCapacityTotal`),
   * 0..1, 0 wenn `creditCapacityTotal` 0 ist. Treibt die Gauge-Farbe
   * (grün→amber→rot) in `FoundationCreditsNewLook`.
   */
  creditUtilizationRatio: number;
  /** Summe der jährlichen Kreditraten aller aktiven Kredite (`getTeamAnnualLoanInstallment`) — Belastungs-Chart. */
  annualLoanInstallment: number;
  /** ECHTE Gehaltssumme des Kaders (`getTeamActualSalaryTotal`, F4) — Belastungs-Chart.
   *  Cashflow-Zahl wie auf der Finanzen-Seite, NICHT die Apron-/Sponsor-Glättung. */
  annualSalaryTotal: number;
  /** Gebäude-Unterhalt aller gebauten Anlagen (`getTeamFacilityUpkeepTotal`) — Belastungs-Chart. */
  annualFacilityUpkeep: number;
  /** Einnahmen-Proxy (`estimateTeamAnnualRevenue`) — oft 0 vor Sponsorvertrag/Season 1, siehe dort. */
  estimatedAnnualRevenue: number;
};

/**
 * EIN KREDIT IRGENDWO IN DER LIGA — fuer die Uebersicht im Kredite-Reiter.
 *
 * CHRIS: „der spieler soll im kredite tab ALLE kredite sehen können mit allen infos die in der liga
 * aktiv oder abgelaufen sind … so dass man sehen kann welches team hat von welchem einen kredit
 * genommen, laufzeit raten usw."
 *
 * Bewusst eine eigene Form neben `ActiveLoan`: dort geht es um die EIGENEN Kredite mit
 * Handlungsmoeglichkeit (Ablose-Angebot), hier um die Liga-Sicht ohne Aktionen. Beide aus derselben
 * Quelle (`seasonState.loans`), damit sie nicht auseinanderlaufen koennen.
 */
export type LeagueLoanRow = {
  id: string;
  /** Wer schuldet. */
  borrowerTeamId: string;
  borrowerName: string;
  /** Wer verleiht — Bank oder ein Team. */
  lenderType: "bank" | "team";
  lenderTeamId: string | null;
  lenderName: string;
  /** Aufgenommene Summe. */
  principal: number;
  /** Was davon noch offen ist. 0 bei abbezahlten Krediten. */
  outstanding: number;
  interestRate: number;
  termSeasons: number;
  remainingSeasons: number;
  installmentPerSeason: number;
  status: string;
  /** In welcher Saison aufgenommen — sonst ist bei alten Krediten nicht klar, woher sie stammen. */
  originatedSeasonId: string | null;
  /** Verpasste Raten; > 0 heisst, dass es klemmt. */
  missedPayments: number;
  /** Das eigene Team ist beteiligt (als Schuldner ODER als Verleiher). */
  involvesOwnTeam: boolean;
};

/** Discriminated view model consumed by the Credits UI. */
export type CreditsViewModel = { status: "not_ready" } | { status: "ready"; team: TeamCreditState };
