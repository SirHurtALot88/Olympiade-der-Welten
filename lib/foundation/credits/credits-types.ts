/**
 * "Kredite" (credits/loans) view-model types.
 *
 * UI-facing shape of a human team's credit state, backed by the real bank
 * credit system in `lib/finance/loan-service.ts` (see
 * `docs/design/kredit-system.md`). Game logic (interest math, capacity,
 * cash mutations) lives entirely in the service — this file only describes
 * what the Credits UI needs to render.
 */

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
};

/** Live-berechnetes Angebot für einen noch nicht aufgenommenen Kredit — aktualisiert sich sofort beim Ziehen/Tippen. */
export type LoanQuote = {
  interestRatePerSeason: number;
  installmentPerSeason: number;
  totalRepayment: number;
  totalInterest: number;
};

/** Warum die Kreditaufnahme gerade gesperrt ist (Formular ausgeblendet, Note statt Slider). */
export type CreditBorrowBlockedReason = "not_preseason" | "no_capacity";

/** Ein menschliches Team's Kredit-Gesamtbild — nur das eigene Team (Fog of War). */
export type TeamCreditState = {
  teamId: string;
  /** Zusätzlicher Kreditrahmen (siehe `computeBorrowingCapacity`), bereits abzüglich bestehender Restschuld. */
  creditLimit: number;
  /** Summe aller aktiven Restschulden (`getTeamOutstandingDebt`). */
  outstandingDebt: number;
  /** Aktuelles Cash des Teams. */
  cash: number;
  /** `TeamIdentity.finances` (0–10, Default 5), fließt in Zinssatz & Kapazität ein. */
  finances: number;
  /** Preseason und `creditLimit > 0`. */
  canBorrow: boolean;
  /** Wenn `!canBorrow`: warum (Preseason-Gate vs. ausgeschöpfter Rahmen). */
  borrowBlockedReason: CreditBorrowBlockedReason | null;
  minTermSeasons: number;
  maxTermSeasons: number;
  activeLoans: ActiveLoan[];
};

/** Discriminated view model consumed by the Credits UI. */
export type CreditsViewModel = { status: "not_ready" } | { status: "ready"; team: TeamCreditState };
