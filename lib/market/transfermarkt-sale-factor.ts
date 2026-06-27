import type { GameState, Player, RosterEntry, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { getTransfermarktBracket } from "@/lib/market/transfermarkt-fit";

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

// Retool `calculateSaleFactorAndPriceSaison` bracketDefs (9 brackets).
const SALE_FACTOR_BRACKET_RANGES = {
  1: { minFactor: 0.35, maxFactor: 1.5 },
  2: { minFactor: 0.4, maxFactor: 1.46 },
  3: { minFactor: 0.45, maxFactor: 1.42 },
  4: { minFactor: 0.5, maxFactor: 1.38 },
  5: { minFactor: 0.55, maxFactor: 1.33 },
  6: { minFactor: 0.6, maxFactor: 1.29 },
  7: { minFactor: 0.66, maxFactor: 1.25 },
  8: { minFactor: 0.72, maxFactor: 1.22 },
  9: { minFactor: 0.75, maxFactor: 1.2 },
} as const;

export type TransfermarktSaleFactorBreakdown = {
  bracket: number | null;
  bracketGroupSize: number;
  baseMarketValue: number | null;
  mvs: number | null;
  ppsSeason: number | null;
  rankInBracket: number | null;
  baseFactor: number | null;
  rankBonus: number | null;
  saleFactor: number | null;
  salePrice: number | null;
  factorSource: "bracket_mvs_live" | "bracket_snapshot_pps" | "fallback_no_ranked_group" | "missing_market_value";
};

type RankedCandidate = {
  playerId: string;
  bracket: number;
  baseMarketValue: number;
  mvs: number;
  ppsSeason: number;
  source: "live" | "snapshot";
};

type SaleFactorRankContext = {
  playerRatingsById: ReturnType<typeof buildPlayerRatingContractMap>;
  groupedCandidates: Map<number, RankedCandidate[]>;
  latestSnapshot: SeasonSnapshotRecord | null;
  hasLivePerformance: boolean;
};

const saleFactorRankContextCache = new WeakMap<GameState, SaleFactorRankContext>();

export function hasCurrentSeasonSaleFactorRanking(gameState: GameState): boolean {
  const appliedResultIds = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((result) => result.seasonId === gameState.season.id && result.status === "preview_applied")
      .map((result) => result.id),
  );

  if (appliedResultIds.size > 0) {
    for (const performance of gameState.seasonState.playerDisciplinePerformances ?? []) {
      if (appliedResultIds.has(performance.matchdayResultId) && (performance.scoreContribution ?? 0) > 0) {
        return true;
      }
    }
    return false;
  }

  if ((gameState.disciplines?.length ?? 0) === 0) {
    return false;
  }

  const ledger = buildSeasonPointsLedger(gameState);
  for (const summary of ledger.playerSummariesByPlayerId.values()) {
    if ((summary.totalPoints ?? 0) > 0) {
      return true;
    }
  }
  return false;
}

function getLatestCompletedSeasonSnapshot(gameState: GameState): SeasonSnapshotRecord | null {
  return [...(gameState.seasonState.seasonSnapshots ?? [])]
    .filter((snapshot) => snapshot.status !== "dry_run" && snapshot.playerPerformances.length > 0)
    .sort((left, right) => {
      const leftTime = Date.parse(left.archivedAt ?? left.createdAt ?? "");
      const rightTime = Date.parse(right.archivedAt ?? right.createdAt ?? "");
      if (Number.isFinite(rightTime) && Number.isFinite(leftTime) && rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return right.seasonId.localeCompare(left.seasonId, "de", { numeric: true });
    })[0] ?? null;
}

function getBracketRange(bracket: number) {
  const normalizedBracket = Math.min(Math.max(bracket, 1), 9) as keyof typeof SALE_FACTOR_BRACKET_RANGES;
  return SALE_FACTOR_BRACKET_RANGES[normalizedBracket];
}

function getRankBonus(rank: number, total: number) {
  if (rank === 1) {
    return 0.15;
  }
  if (rank === 2) {
    return 0.1;
  }
  if (rank === 3) {
    return 0.05;
  }
  if (rank === total) {
    return -0.15;
  }
  if (rank === total - 1) {
    return -0.1;
  }
  if (rank === total - 2) {
    return -0.05;
  }
  return 0;
}

export function normalizeVisibleRosterMoney(
  rosterValue: number | null | undefined,
  importedDisplayValue: number | null | undefined,
) {
  if (typeof rosterValue !== "number" || !Number.isFinite(rosterValue)) {
    return importedDisplayValue ?? null;
  }

  if (
    rosterValue > 1000 &&
    typeof importedDisplayValue === "number" &&
    Number.isFinite(importedDisplayValue) &&
    importedDisplayValue > 0
  ) {
    return importedDisplayValue;
  }

  if (rosterValue > 1000) {
    return roundValue(rosterValue / 100, 2);
  }

  return roundValue(rosterValue, 2);
}

function buildRankedCandidates(
  gameState: GameState,
  playerRatingsById: ReturnType<typeof buildPlayerRatingContractMap>,
  hasLivePerformance: boolean,
  latestSnapshot: SeasonSnapshotRecord | null,
) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  const groupedCandidates = new Map<number, RankedCandidate[]>();
  const livePerformancePointsByPlayerId = new Map<string, number>();
  if (hasLivePerformance) {
    for (const performance of gameState.seasonState.playerDisciplinePerformances ?? []) {
      if (!performance.playerId || !Number.isFinite(performance.scoreContribution)) {
        continue;
      }
      livePerformancePointsByPlayerId.set(
        performance.playerId,
        roundValue((livePerformancePointsByPlayerId.get(performance.playerId) ?? 0) + performance.scoreContribution, 4),
      );
    }
  }
  const snapshotPerformanceByPlayerId = new Map(
    (latestSnapshot?.playerPerformances ?? []).map((performance) => [performance.playerId, performance] as const),
  );

  for (const rosterEntry of gameState.rosters) {
    const player = playersById.get(rosterEntry.playerId);
    if (!player) {
      continue;
    }

    const economy = resolvePlayerEconomyContract({ player, rosterEntry });
    const baseMarketValue = normalizeVisibleRosterMoney(rosterEntry.currentValue, economy.marketValue);
    if (baseMarketValue == null || baseMarketValue <= 0) {
      continue;
    }

    const bracket = getTransfermarktBracket(baseMarketValue);
    const rating = playerRatingsById.get(player.id);
    const snapshotPerformance = snapshotPerformanceByPlayerId.get(player.id) ?? null;
    const snapshotPoints = snapshotPerformance?.totalPoints ?? snapshotPerformance?.totalContribution ?? null;
    const livePerformancePoints = livePerformancePointsByPlayerId.get(player.id) ?? 0;
    const liveMvs = rating?.mvs != null && rating.mvs > 0 ? rating.mvs : livePerformancePoints;
    const rankingValue = hasLivePerformance ? liveMvs : snapshotPoints ?? 0;
    const candidate: RankedCandidate = {
      playerId: player.id,
      bracket,
      baseMarketValue,
      mvs: rankingValue,
      ppsSeason: hasLivePerformance ? rating?.ppsSeason ?? livePerformancePoints : snapshotPoints ?? 0,
      source: hasLivePerformance ? "live" : "snapshot",
    };

    const bucket = groupedCandidates.get(bracket) ?? [];
    bucket.push(candidate);
    groupedCandidates.set(bracket, bucket);
  }

  return groupedCandidates;
}

function getSaleFactorRankContext(gameState: GameState): SaleFactorRankContext {
  const cached = saleFactorRankContextCache.get(gameState);
  if (cached) {
    return cached;
  }

  const playerRatingsById = buildPlayerRatingContractMap(gameState);
  const hasLivePerformance = hasCurrentSeasonSaleFactorRanking(gameState);
  const latestSnapshot = hasLivePerformance ? null : getLatestCompletedSeasonSnapshot(gameState);
  const groupedCandidates = buildRankedCandidates(gameState, playerRatingsById, hasLivePerformance, latestSnapshot);
  const context = {
    playerRatingsById,
    groupedCandidates,
    latestSnapshot,
    hasLivePerformance,
  };
  saleFactorRankContextCache.set(gameState, context);
  return context;
}

export function buildTransfermarktSaleFactorBreakdown(
  gameState: GameState,
  player: Player | null | undefined,
  rosterEntry?: RosterEntry | null,
): TransfermarktSaleFactorBreakdown {
  const economy = resolvePlayerEconomyContract({ player, rosterEntry });
  const baseMarketValue = normalizeVisibleRosterMoney(rosterEntry?.currentValue, economy.marketValue) ?? economy.marketValue ?? null;

  if (baseMarketValue == null || baseMarketValue <= 0) {
    return {
      bracket: null,
      bracketGroupSize: 0,
      baseMarketValue: null,
      mvs: null,
      ppsSeason: null,
      rankInBracket: null,
      baseFactor: null,
      rankBonus: null,
      saleFactor: null,
      salePrice: null,
      factorSource: "missing_market_value",
    };
  }

  const bracket = getTransfermarktBracket(baseMarketValue);
  if (!hasCurrentSeasonSaleFactorRanking(gameState)) {
    return {
      bracket,
      bracketGroupSize: 0,
      baseMarketValue,
      mvs: null,
      ppsSeason: null,
      rankInBracket: null,
      baseFactor: 1,
      rankBonus: 0,
      saleFactor: 1,
      salePrice: baseMarketValue,
      factorSource: "fallback_no_ranked_group",
    };
  }

  const rankContext = getSaleFactorRankContext(gameState);
  const playerRating = player ? rankContext.playerRatingsById.get(player.id) ?? null : null;
  const latestSnapshot = rankContext.latestSnapshot;
  const snapshotPerformance = player
    ? latestSnapshot?.playerPerformances.find((performance) => performance.playerId === player.id) ?? null
    : null;
  const snapshotPoints = snapshotPerformance?.totalPoints ?? snapshotPerformance?.totalContribution ?? null;
  const rankedGroup = (rankContext.groupedCandidates.get(bracket) ?? [])
    .filter((candidate) => candidate.mvs > 0)
    .sort((left, right) => {
      if (right.mvs !== left.mvs) {
        return right.mvs - left.mvs;
      }
      if (right.ppsSeason !== left.ppsSeason) {
        return right.ppsSeason - left.ppsSeason;
      }
      return left.playerId.localeCompare(right.playerId, "de");
    });

  const rankedIndex = player ? rankedGroup.findIndex((candidate) => candidate.playerId === player.id) : -1;
  if (rankedIndex < 0) {
    return {
      bracket,
      bracketGroupSize: rankedGroup.length,
      baseMarketValue,
      mvs: playerRating?.mvs ?? snapshotPoints ?? null,
      ppsSeason: playerRating?.ppsSeason ?? snapshotPoints ?? null,
      rankInBracket: null,
      baseFactor: 1,
      rankBonus: 0,
      saleFactor: 1,
      salePrice: baseMarketValue,
      factorSource: "fallback_no_ranked_group",
    };
  }

  const rankInBracket = rankedIndex + 1;
  const bracketRange = getBracketRange(bracket);
  const step = (bracketRange.maxFactor - bracketRange.minFactor) / Math.max(1, rankedGroup.length - 1);
  const baseFactor = bracketRange.maxFactor - rankedIndex * step;
  const rankBonus = getRankBonus(rankInBracket, rankedGroup.length);
  const saleFactor = baseFactor + rankBonus;
  const factorSource = rankedGroup[rankedIndex]?.source === "snapshot" ? "bracket_snapshot_pps" : "bracket_mvs_live";

  return {
    bracket,
    bracketGroupSize: rankedGroup.length,
    baseMarketValue,
    mvs: playerRating?.mvs ?? snapshotPoints ?? null,
    ppsSeason: playerRating?.ppsSeason ?? snapshotPoints ?? null,
    rankInBracket,
    baseFactor: roundValue(baseFactor, 3),
    rankBonus: roundValue(rankBonus, 2),
    saleFactor: roundValue(saleFactor, 3),
    salePrice: roundValue(baseMarketValue * saleFactor, 2),
    factorSource,
  };
}
