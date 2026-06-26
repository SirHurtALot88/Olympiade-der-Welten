import type { GameState, TeamSponsorContract } from "@/lib/data/olyDataTypes";

const BRAND_HISTORY_LIMIT = 4;

export function getRecentSponsorParentIds(gameState: GameState, teamId: string): string[] {
  return gameState.seasonState.sponsorBrandHistoryByTeamId?.[teamId] ?? [];
}

export function appendSponsorBrandHistory(gameState: GameState, teamId: string, parentBrandId: string | undefined): GameState {
  if (!parentBrandId) {
    return gameState;
  }
  const current = gameState.seasonState.sponsorBrandHistoryByTeamId?.[teamId] ?? [];
  const nextHistory = [...current, parentBrandId].slice(-BRAND_HISTORY_LIMIT);
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorBrandHistoryByTeamId: {
        ...(gameState.seasonState.sponsorBrandHistoryByTeamId ?? {}),
        [teamId]: nextHistory,
      },
    },
  };
}

export function isActiveSponsorContract(contract: TeamSponsorContract | null | undefined, seasonId: string) {
  if (!contract) {
    return false;
  }
  if ((contract.seasonsRemaining ?? 1) <= 0) {
    return false;
  }
  // Contract is active when it belongs to the current season or still has remaining terms.
  // The seasonsRemaining > 0 guard above already covers the multi-season case;
  // require seasonId match here to avoid carrying a stale single-season contract forward.
  return contract.seasonId === seasonId || (contract.seasonsRemaining ?? 0) > 1;
}

export function advanceSponsorContractsForNewSeason(gameState: GameState, nextSeasonId: string): GameState {
  const contracts = { ...(gameState.seasonState.sponsorContractsByTeamId ?? {}) };
  const offers = { ...(gameState.seasonState.sponsorOffersByTeamId ?? {}) };
  let nextGameState = gameState;

  for (const team of gameState.teams) {
    const contract = contracts[team.teamId];
    if (!contract) {
      offers[team.teamId] = [];
      continue;
    }

    const remaining = contract.seasonsRemaining ?? 1;
    if (remaining <= 1) {
      delete contracts[team.teamId];
      offers[team.teamId] = [];
      continue;
    }

    const rolledContract: TeamSponsorContract = {
      ...contract,
      seasonId: nextSeasonId,
      seasonsRemaining: remaining - 1,
      payouts: {},
      chosenAt: contract.chosenAt,
    };
    contracts[team.teamId] = rolledContract;
    offers[team.teamId] = [];
  }

  nextGameState = {
    ...nextGameState,
    seasonState: {
      ...nextGameState.seasonState,
      sponsorContractsByTeamId: contracts,
      sponsorOffersByTeamId: offers,
    },
  };

  return nextGameState;
}
