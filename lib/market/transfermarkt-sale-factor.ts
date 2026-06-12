import type { GameState, Player, RosterEntry, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { getImportedPlayerDisplayMarketValue } from "@/lib/data/player-economy-display";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { getTransfermarktBracket } from "@/lib/market/transfermarkt-fit";

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

const SALE_FACTOR_BRACKET_RANGES = {
  1: { minFactor: 0.35, maxFactor: 1.5 },
  2: { minFactor: 0.35, maxFactor: 1.5 },
  3: { minFactor: 0.45, maxFactor: 1.4 },
  4: { minFactor: 0.55, maxFactor: 1.3 },
  5: { minFactor: 0.65, maxFactor: 1.25 },
  6: { minFactor: 0.75, maxFactor: 1.2 },
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
  const normalizedBracket = Math.min(Math.max(bracket, 1), 6) as keyof typeof SALE_FACTOR_BRACKET_RANGES;
  return SALE_FACTOR_BRACKET_RANGES[normalizedBracket];
}

function getRankBonus(rank: number, total: number) {
  if (total <= 1) {
    return 0;
  }

  const topBonus =
    rank === 1 ? 0.15
    : rank === 2 ? 0.1
    : rank === 3 ? 0.05
    : null;
  const bottomBonus =
    rank === total ? -0.15
    : rank === total - 1 ? -0.1
    : rank === total - 2 ? -0.05
    : null;

  if (topBonus != null && bottomBonus != null) {
    const middleRank = (total + 1) / 2;
    if (Number.isInteger(middleRank) && rank === middleRank) {
      return 0;
    }

    return rank < middleRank ? topBonus : bottomBonus;
  }

  return topBonus ?? bottomBonus ?? 0;
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

  return roundValue(rosterValue, 2);
}

function buildRankedCandidates(gameState: GameState) {
  const playerRatingsById = buildPlayerRatingContractMap(gameState);
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  const groupedCandidates = new Map<number, RankedCandidate[]>();
  const hasLivePerformance = (gameState.seasonState.playerDisciplinePerformances ?? []).length > 0;
  const latestSnapshot = hasLivePerformance ? null : getLatestCompletedSeasonSnapshot(gameState);
  const snapshotPerformanceByPlayerId = new Map(
    (latestSnapshot?.playerPerformances ?? []).map((performance) => [performance.playerId, performance] as const),
  );

  for (const rosterEntry of gameState.rosters) {
    const player = playersById.get(rosterEntry.playerId);
    if (!player) {
      continue;
    }

    const baseMarketValue = getImportedPlayerDisplayMarketValue(player);
    if (baseMarketValue == null || baseMarketValue <= 0) {
      continue;
    }

    const bracket = getTransfermarktBracket(baseMarketValue);
    const rating = playerRatingsById.get(player.id);
    const snapshotPerformance = snapshotPerformanceByPlayerId.get(player.id) ?? null;
    const snapshotPoints = snapshotPerformance?.totalPoints ?? snapshotPerformance?.totalContribution ?? null;
    const rankingValue = hasLivePerformance ? rating?.mvs ?? 0 : snapshotPoints ?? 0;
    const candidate: RankedCandidate = {
      playerId: player.id,
      bracket,
      baseMarketValue,
      mvs: rankingValue,
      ppsSeason: hasLivePerformance ? rating?.ppsSeason ?? 0 : snapshotPoints ?? 0,
      source: hasLivePerformance ? "live" : "snapshot",
    };

    const bucket = groupedCandidates.get(bracket) ?? [];
    bucket.push(candidate);
    groupedCandidates.set(bracket, bucket);
  }

  return groupedCandidates;
}

export function buildTransfermarktSaleFactorBreakdown(
  gameState: GameState,
  player: Player | null | undefined,
  rosterEntry?: RosterEntry | null,
): TransfermarktSaleFactorBreakdown {
  const importedMarketValue = player ? getImportedPlayerDisplayMarketValue(player) : null;
  const fallbackBaseMarketValue = normalizeVisibleRosterMoney(rosterEntry?.currentValue, importedMarketValue);
  const baseMarketValue = importedMarketValue ?? fallbackBaseMarketValue ?? null;

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
  const playerRatingsById = buildPlayerRatingContractMap(gameState);
  const playerRating = player ? playerRatingsById.get(player.id) ?? null : null;
  const latestSnapshot = (gameState.seasonState.playerDisciplinePerformances ?? []).length > 0
    ? null
    : getLatestCompletedSeasonSnapshot(gameState);
  const snapshotPerformance = player
    ? latestSnapshot?.playerPerformances.find((performance) => performance.playerId === player.id) ?? null
    : null;
  const snapshotPoints = snapshotPerformance?.totalPoints ?? snapshotPerformance?.totalContribution ?? null;
  const groupedCandidates = buildRankedCandidates(gameState);
  const rankedGroup = (groupedCandidates.get(bracket) ?? [])
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
