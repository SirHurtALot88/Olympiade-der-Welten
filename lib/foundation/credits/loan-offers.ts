/**
 * Loan offer marketplace for the "Kredite" tab — see
 * `docs/design/kredit-system.md` §"Phase 3 — Team-zu-Team-Kredite
 * (Detailkonzept)" / §"Angebots-UI" and the "Seam-Vertrag für die UI
 * (Phase 3)" section appended there.
 *
 * The Credits UI no longer treats the amount slider as a direct borrow
 * action. Instead the slider + Laufzeit dropdown are a FILTER: they
 * parametrize a `{ amount, termSeasons }` request, and `buildLoanOffers`
 * turns that request into a sorted list of lender offers (bank today,
 * teams from Phase 3 onward). The component renders one card per offer and
 * lets the player pick which one to borrow from.
 */

import type { GameState } from "@/lib/data/olyDataTypes";
import { computeLoanTerms, originateLoan } from "@/lib/finance/loan-service";

const MIN_TERM_SEASONS = 1;
const MAX_TERM_SEASONS = 10;

export type LoanOffer = {
  lenderType: "bank" | "team";
  /** `null` for the bank; the lender's `teamId` for team offers (Phase 3). */
  lenderTeamId: string | null;
  /** "Bank" or the lender team's display name. */
  lenderName: string;
  /** Most this lender will lend right now, independent of the requested amount. */
  maxAmount: number;
  /** Rate for the requested amount + term (fixed at origination, see `computeLoanTerms`). */
  interestRatePerSeason: number;
  /** Annuity installment for the requested amount + term at `interestRatePerSeason`. */
  installmentPerSeason: number;
  /** Team lenders only — used for the relationship badge; `null`/absent for the bank. */
  relationship?: number | null;
  /** `maxAmount >= request.amount` — cards with `eligible: false` render disabled/greyed. */
  eligible: boolean;
};

export type LoanOfferRequest = {
  amount: number;
  termSeasons: number;
};

/**
 * Builds the full offer list for `borrowerTeamId` at the given `request`
 * (amount + term). Cheapest interest first. Recompute on every filter
 * change (amount/termSeasons) — this is pure/derived, no mutation.
 */
export function buildLoanOffers(gameState: GameState, borrowerTeamId: string, request: LoanOfferRequest): LoanOffer[] {
  const termSeasons = clampTermSeasons(request.termSeasons);
  const amount = Math.max(0, Number.isFinite(request.amount) ? request.amount : 0);

  const identity = gameState.teamIdentities.find((entry) => entry.teamId === borrowerTeamId) ?? null;
  const finances = identity?.finances ?? 5;

  const offers: LoanOffer[] = [];

  // --- BANK offer (Phase 1, live today) ---------------------------------
  // Capacity via the exact same probe path `buildCreditsViewModel` uses:
  // `originateLoan(..., { execute: false }).capacity`. `principal`/`termSeasons`
  // passed into the probe are throwaway — `computeBorrowingCapacity` does not
  // depend on either, only on market value / revenue / current outstanding
  // debt — so this can never drift from what the mutation route accepts.
  const capacityProbe = originateLoan(gameState, { borrowerTeamId, principal: 1, termSeasons }, { execute: false });
  const bankCapacity = Math.max(0, capacityProbe.capacity);
  const bankTerms = computeLoanTerms({ principal: amount, termSeasons, finances });

  offers.push({
    lenderType: "bank",
    lenderTeamId: null,
    lenderName: "Bank",
    maxAmount: bankCapacity,
    interestRatePerSeason: bankTerms.interestRatePerSeason,
    installmentPerSeason: bankTerms.installmentPerSeason,
    relationship: null,
    eligible: amount <= bankCapacity,
  });

  // === SEAM: Phase 3 team-to-team offers connect HERE ===
  //
  // Returns none today on purpose. The list already renders 1..N cards
  // generically (sorted by `interestRatePerSeason` ascending), so team
  // offers pushed into `offers` below need zero further UI work.
  //
  // Spec (see docs/design/kredit-system.md §"Verleiher-Eligibilität" +
  // §"Konditionen", copied into the "Seam-Vertrag für die UI (Phase 3)"
  // section of that doc verbatim):
  //
  // for (const lender of gameState.teams) {
  //   if (lender.teamId === borrowerTeamId) continue;
  //
  //   // 1) Free-lendable cash — NOT bare `lender.cash`. A team only lends
  //   //    what it does not need as its own liquidity buffer, otherwise it
  //   //    ruins its own economy.
  //   const freeLendableCash = Math.max(
  //     0,
  //     lender.cash - resolveTeamLiquidityBufferTarget(gameState, lender.teamId), // lib/ai/planner-cash-buffer-policy.ts
  //   );
  //   if (freeLendableCash <= 0) continue; // nothing to offer, don't render a 0-max card
  //
  //   // 2) Relationship gate — rivals do not lend at all (no card, not even
  //   //    disabled). `getTeamRelationship` returns a `TeamRelationshipRecord
  //   //    | null`, so read `.value` (default 0), NOT the record itself.
  //   const relationshipValue = getTeamRelationship(lender.teamId, borrowerTeamId)?.value ?? 0; // lib/rivalries/team-rivalries.ts
  //   const RIVAL_CUTOFF = -4; // relationship <= this → hostile, no offer (see doc)
  //   if (relationshipValue <= RIVAL_CUTOFF) continue;
  //
  //   // 3) Rate — teams always undercut the bank slightly. `computeLoanTerms`
  //   //    derives ITS OWN rate from `finances` and cannot take an externally
  //   //    supplied rate, so the annuity installment for a team offer needs a
  //   //    small helper that takes `{ principal, termSeasons, rate }` directly
  //   //    (same formula as `computeLoanTerms`'s internal annuity branch,
  //   //    A = P * r / (1 - (1+r)^-n)) instead of deriving `rate` from
  //   //    `finances`. Consider exporting that piece from loan-service.ts so
  //   //    both call sites (bank + team) share one annuity implementation.
  //   const INTERACTION_DISCOUNT = 0.01;             // teams are always ~1% cheaper than the bank
  //   const relationshipDiscount = Math.max(0, relationshipValue) / 5 * 0.03; // +5 rel → up to -3%
  //   const lenderYieldAppetite = 0; // small extra discount for high-finances/cashPriority lenders who WANT the deal — tune per doc example
  //   const TEAM_RATE_FLOOR = 0.05; // slightly below the bank floor (0.07)
  //   const teamRate = clamp(
  //     bankTerms.interestRatePerSeason - INTERACTION_DISCOUNT - relationshipDiscount - lenderYieldAppetite,
  //     TEAM_RATE_FLOOR,
  //     bankTerms.interestRatePerSeason - INTERACTION_DISCOUNT,
  //   );
  //   const teamInstallment = computeAnnuityInstallment({ principal: amount, termSeasons, rate: teamRate });
  //
  //   offers.push({
  //     lenderType: "team",
  //     lenderTeamId: lender.teamId,
  //     lenderName: lender.name,
  //     maxAmount: freeLendableCash,
  //     interestRatePerSeason: teamRate,
  //     installmentPerSeason: teamInstallment,
  //     relationship: relationshipValue,
  //     eligible: freeLendableCash >= amount,
  //   });
  // }
  //
  // Two more pieces this seam depends on that live OUTSIDE this function —
  // not implemented here, see the "Seam-Vertrag für die UI (Phase 3)"
  // section in docs/design/kredit-system.md for the exact contract:
  //   - `originateLoan` (lib/finance/loan-service.ts) must accept
  //     `lenderType: "team"` + `lenderTeamId`: debit the lender's cash at
  //     origination (mirror the borrower credit) instead of only crediting
  //     the borrower.
  //   - `loan_settlement` (`applyLoanSettlement`/`buildSettlementRows`) must
  //     pay the installment's cash to the lender at season settlement
  //     instead of it "disappearing" to the bank — the interest portion is
  //     the lender's profit.
  //   - The `team_lending_not_available` guard in
  //     app/api/finance/loan/originate/route.ts must be removed once
  //     `originateLoan` supports `lenderType: "team"`.

  return offers.sort((a, b) => a.interestRatePerSeason - b.interestRatePerSeason);
}

function clampTermSeasons(value: number): number {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return MIN_TERM_SEASONS;
  return Math.min(MAX_TERM_SEASONS, Math.max(MIN_TERM_SEASONS, rounded));
}
