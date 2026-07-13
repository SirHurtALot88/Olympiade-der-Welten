"use client";

import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamOutstandingDebt, originateLoan } from "@/lib/finance/loan-service";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import type { CreditsViewModel, TeamCreditState } from "@/lib/foundation/credits/credits-types";

const MIN_TERM_SEASONS = 1;
const MAX_TERM_SEASONS = 10;

/**
 * Builds the Credits view model for one human team, wired to the real bank
 * credit system (`lib/finance/loan-service.ts`, see
 * `docs/design/kredit-system.md`).
 *
 * Fog of war: this must only ever be called with the ACTIVE MANAGER's own
 * team id (`activeManagerTeamId`, same id used by other "own team finances"
 * views like Sponsoren). Never pass another team's id in here — the credit
 * system is not league-visible data.
 */
export function buildCreditsViewModel(gameState: GameState, teamId: string | null): CreditsViewModel {
  if (!teamId) {
    return { status: "not_ready" };
  }

  const team = gameState.teams.find((candidate) => candidate.teamId === teamId);
  if (!team) {
    return { status: "not_ready" };
  }

  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  const finances = identity?.finances ?? 5;

  const outstandingDebt = getTeamOutstandingDebt(gameState, teamId);

  // Single source of truth for capacity: the exact same preview path
  // `originateLoan` uses internally when it validates a real borrow request
  // (principal/termSeasons here are throwaway probe values — capacity does
  // not depend on either). This guarantees the KPI/slider max can never
  // drift from what the mutation route will actually accept.
  const capacityProbe = originateLoan(
    gameState,
    { borrowerTeamId: teamId, principal: 1, termSeasons: MIN_TERM_SEASONS },
    { execute: false },
  );
  const creditLimit = capacityProbe.capacity;

  const activeLoans = (gameState.seasonState.loans ?? [])
    .filter((loan) => loan.borrowerTeamId === teamId && loan.status === "active")
    .map((loan) => ({
      id: loan.loanId,
      principal: loan.principalOriginal,
      outstanding: loan.principalOutstanding,
      interestRate: loan.interestRatePerSeason,
      termSeasons: loan.termSeasons,
      remainingSeasons: loan.seasonsRemaining,
      nextInstalment: loan.installmentPerSeason,
      status: loan.status,
    }));

  const isPreseason = evaluateGamePhaseAction(gameState, "credit_borrow").allowed;
  const canBorrow = isPreseason && creditLimit > 0;
  const borrowBlockedReason = canBorrow ? null : !isPreseason ? "not_preseason" : "no_capacity";

  const teamCreditState: TeamCreditState = {
    teamId,
    creditLimit,
    outstandingDebt,
    cash: team.cash,
    finances,
    canBorrow,
    borrowBlockedReason,
    minTermSeasons: MIN_TERM_SEASONS,
    maxTermSeasons: MAX_TERM_SEASONS,
    activeLoans,
  };

  return { status: "ready", team: teamCreditState };
}

/**
 * React hook wrapper around `buildCreditsViewModel`. Hosts should prefer
 * this over calling the builder directly so the model is memoized per
 * render the same way other Foundation view models are.
 */
export function useCreditsViewModel(gameState: GameState, teamId: string | null): CreditsViewModel {
  return useMemo(() => buildCreditsViewModel(gameState, teamId), [gameState, teamId]);
}
