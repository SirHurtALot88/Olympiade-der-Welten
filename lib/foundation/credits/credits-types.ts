/**
 * "Kredite" (credits/loans) data seam types.
 *
 * These types describe the UI-facing shape of a human team's credit state.
 * They intentionally carry no game logic (interest math, eligibility rules,
 * cash mutations) — that lives in the parallel credit system. This file is
 * the contract the UI scaffold and the future real data source agree on.
 */

/** A credit offer a team could take out. */
export type CreditOffer = {
  /** Stable id, passed back via `onTakeLoan(offerId)`. */
  id: string;
  /** Display label, e.g. "Kurzfristiger Kredit". */
  label: string;
  /** Lower bound of the principal range the team could borrow. */
  principalMin: number;
  /** Upper bound of the principal range the team could borrow. */
  principalMax: number;
  /** Interest rate as a fraction, e.g. 0.08 for 8%. */
  interestRate: number;
  /** Loan term expressed in matchdays. */
  termMatchdays: number;
};

/** A loan the team currently owes money on. */
export type ActiveLoan = {
  /** Stable id, passed back via `onRepayLoan(loanId)`. */
  id: string;
  /** Original amount borrowed. */
  principal: number;
  /** Amount still outstanding. */
  outstanding: number;
  /** Interest rate as a fraction, e.g. 0.08 for 8%. */
  interestRate: number;
  /** Matchdays remaining until the loan is fully repaid. */
  remainingMatchdays: number;
  /** Amount due at the next instalment. */
  nextInstalment: number;
};

/** A human team's full credit picture — own team only (fog of war applies). */
export type TeamCreditState = {
  teamId: string;
  /** Total amount the team is still allowed to borrow. */
  creditLimit: number;
  /** Sum of all outstanding loan balances. */
  outstandingDebt: number;
  /** Blended/representative interest rate, or null if not applicable. */
  interestRate: number | null;
  /** Next instalment due across all active loans, or null if none due. */
  nextInstalment: number | null;
  activeLoans: ActiveLoan[];
  offers: CreditOffer[];
};

/**
 * Discriminated view model consumed by the Credits UI.
 *
 * `"not_ready"` is the current stub state (the parallel credit system isn't
 * wired up yet). Once connected, `buildCreditsViewModel` returns
 * `{ status: "ready", team }` and the UI renders the real data — no other
 * file needs to change.
 */
export type CreditsViewModel = { status: "not_ready" } | { status: "ready"; team: TeamCreditState };
