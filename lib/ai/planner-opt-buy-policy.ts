import type { GameState } from "@/lib/data/olyDataTypes";

/** MW cap for reserve/backup lane — aligned with AI_RESERVE_MARKET_VALUE_CAP. */
export const PLANNER_RESERVE_LANE_MW_CAP = 20;

/**
 * Tight-budget threshold (MW cash per open slot) below which a team abandons core/depth lanes and
 * collapses into backup/reserve (see `prefersReserveLaneOverCheapFill`). Lowered 15 -> 12 so the
 * reserve collapse fires only under genuinely tight budgets; teams in the 12-15 MW/slot band now keep
 * buying real core/depth/star instead of dumping into reserve. Organic nudge (no hard quotas); aligns
 * the constant with its own long-documented "~12M/player" intent.
 */
export const PLANNER_TIGHT_BUDGET_CASH_PER_SLOT = 12;

export type PlannedBuyCandidate = {
  price?: number | null;
  marketValue?: number | null;
  overallRecommendationScore?: number | null;
  score?: number | null;
  strategicBuyScore?: number | null;
};

export function isTeamAtOrAboveOpt(rosterCount: number, playerOpt: number) {
  return rosterCount >= playerOpt;
}

export function getPlannedExpiryBuyNeed(input: {
  rosterCount: number;
  playerOpt: number;
  expiringCount: number;
}) {
  const rosterAfterExpiry = Math.max(0, input.rosterCount - input.expiringCount);
  return Math.max(0, input.playerOpt - rosterAfterExpiry);
}

export function prefersReserveLaneOverCheapFill(input: { rosterGap: number; cash: number | null | undefined }) {
  if (input.rosterGap <= 0) return false;
  if (input.cash == null || !Number.isFinite(input.cash) || input.cash <= 0) return false;
  return input.cash / input.rosterGap <= PLANNER_TIGHT_BUDGET_CASH_PER_SLOT;
}

/** Cash reserve = 0 until Opt reached; rebuild buffer only after Opt. */
export function resolveBelowOptCashReserve(input: { rosterGap: number; minimumReserveCash: number | null }) {
  if (input.rosterGap > 0) return 0;
  return input.minimumReserveCash;
}

export function candidateRecommendationScore(candidate: PlannedBuyCandidate) {
  return candidate.strategicBuyScore ?? candidate.overallRecommendationScore ?? candidate.score ?? 0;
}

/** Trash heuristic: weak score and/or sub-reserve-floor filler — easy gate only. */
export function isTrashMarketBuyCandidate(input: {
  price?: number | null;
  marketValue?: number | null;
  score?: number | null;
  reserveFloorMw?: number;
}) {
  const price = input.price ?? input.marketValue ?? null;
  if (price == null || price <= 0) return true;
  const score = input.score ?? 0;
  const floor = input.reserveFloorMw ?? PLANNER_RESERVE_LANE_MW_CAP;
  if (price + 0.01 < floor * 0.45 && score < 42) return true;
  if (price <= 8 && score < 35) return true;
  return false;
}

export function filterQualityPlannedBuyCandidates<T extends PlannedBuyCandidate>(candidates: T[]) {
  return candidates.filter(
    (candidate) =>
      !isTrashMarketBuyCandidate({
        price: candidate.price,
        marketValue: candidate.marketValue,
        score: candidateRecommendationScore(candidate),
      }),
  );
}

export function shouldBlockEmergencyPathAtOpt(rosterCount: number, playerOpt: number) {
  return isTeamAtOrAboveOpt(rosterCount, playerOpt);
}

export type ReserveLaneCandidateProbe = {
  marketValue?: number | null;
  price?: number | null;
};

/** True when strategic pool already has affordable reserve-lane fillers (skip emergency path). */
export function strategicPoolHasReserveLaneCandidates(input: {
  candidates: ReserveLaneCandidateProbe[];
  teamCash: number;
  rosterBelowHardMin: boolean;
}) {
  if (input.rosterBelowHardMin) return false;
  if (input.teamCash <= 0) return false;
  return input.candidates.some((candidate) => {
    const price = candidate.price ?? candidate.marketValue ?? null;
    if (price == null || price <= 0 || price > PLANNER_RESERVE_LANE_MW_CAP + 0.01) return false;
    return price <= input.teamCash + 0.01;
  });
}

export function filterEmergencyRepairTeamIds(
  gameState: GameState,
  teamIds: string[],
  getRosterCount: (gameState: GameState, teamId: string) => number,
  getOptTarget: (gameState: GameState, teamId: string) => number,
) {
  return teamIds.filter((teamId) => {
    const rosterCount = getRosterCount(gameState, teamId);
    const playerOpt = getOptTarget(gameState, teamId);
    return !shouldBlockEmergencyPathAtOpt(rosterCount, playerOpt);
  });
}

export function resolveAllowedMarketBuyCount(input: {
  rosterBase: number | null;
  currentRoster: number | null;
  playerOpt: number;
  expiringCount: number;
  plannedCandidates: PlannedBuyCandidate[];
  maxBuysPerTeam: number | null;
  postOptUpgradeDeploy?: boolean;
  minUpgradeBuyPrice?: number | null;
  topCandidateScore?: number;
  plannedSellCount?: number;
  maxUpgradeBuys?: number;
}) {
  const optionLimit = input.maxBuysPerTeam ?? Number.POSITIVE_INFINITY;
  const currentRoster = input.rosterBase ?? input.currentRoster;
  const playerOpt = input.playerOpt;

  if (currentRoster == null) {
    return optionLimit;
  }

  const plannedExpiryNeed = getPlannedExpiryBuyNeed({
    rosterCount: currentRoster,
    playerOpt,
    expiringCount: input.expiringCount,
  });
  if (plannedExpiryNeed > 0) {
    return Math.min(Math.max(plannedExpiryNeed, 1), optionLimit);
  }

  if (currentRoster < playerOpt) {
    return Math.min(Math.max(playerOpt - currentRoster, 0), optionLimit);
  }

  const qualityPlanned = filterQualityPlannedBuyCandidates(input.plannedCandidates);
  if (!input.postOptUpgradeDeploy) {
    return 0;
  }

  const onTopLimit = Math.min(input.maxUpgradeBuys ?? 2, 3, optionLimit);
  if (qualityPlanned.length === 0) {
    const depthCandidates = input.plannedCandidates.filter(
      (candidate) =>
        !isTrashMarketBuyCandidate({
          price: candidate.price,
          marketValue: candidate.marketValue,
          score: candidateRecommendationScore(candidate),
          reserveFloorMw: PLANNER_RESERVE_LANE_MW_CAP * 0.35,
        }),
    );
    if (depthCandidates.length === 0) return 0;
    return Math.min(depthCandidates.length, onTopLimit);
  }
  return Math.min(qualityPlanned.length, onTopLimit);
}
