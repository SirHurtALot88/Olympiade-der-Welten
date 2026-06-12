import type {
  MarketValueDisciplineInput,
  MarketValueEngineResult,
  MarketValueFixtureResult,
  RankToDisciplineMarketValueRow,
} from "@/lib/player-formulas/player-formula-types";

function roundTo2(value: number) {
  return Number(value.toFixed(2));
}

export const MARKET_VALUE_BASE_OFFSET = 3.5;

function mapRankToDisciplineMarketValue(rank: number, table: RankToDisciplineMarketValueRow[]) {
  return table.find((entry) => entry.rank === rank)?.disciplineMarketValue ?? null;
}

function buildCompetitionRanks(players: MarketValueDisciplineInput[], disciplineId: string) {
  const ranked = [...players].sort((left, right) => {
    const rightScore = right.scores[disciplineId] ?? Number.NEGATIVE_INFINITY;
    const leftScore = left.scores[disciplineId] ?? Number.NEGATIVE_INFINITY;
    return rightScore - leftScore;
  });

  const rankMap = new Map<string, number>();
  let currentRank = 1;

  ranked.forEach((player, index) => {
    if (index > 0) {
      const previous = ranked[index - 1];
      const previousScore = previous?.scores[disciplineId] ?? Number.NEGATIVE_INFINITY;
      const currentScore = player.scores[disciplineId] ?? Number.NEGATIVE_INFINITY;
      if (currentScore !== previousScore) {
        currentRank = index + 1;
      }
    }
    rankMap.set(player.playerId, currentRank);
  });

  return rankMap;
}

export function calculateMarketValueFromRankTable(input: {
  players: MarketValueDisciplineInput[];
  rankToDisciplineMarketValue: RankToDisciplineMarketValueRow[] | null;
}): MarketValueEngineResult {
  if (!input.rankToDisciplineMarketValue || input.rankToDisciplineMarketValue.length === 0) {
    return {
      status: "blocked_missing_rank_to_mw_source",
      players: [],
      warnings: ["rank_to_discipline_market_value_source_missing"],
    };
  }

  const disciplineIds = [
    ...new Set(input.players.flatMap((player) => Object.keys(player.scores))),
  ];
  const rankMaps = new Map<string, Map<string, number>>();

  disciplineIds.forEach((disciplineId) => {
    rankMaps.set(disciplineId, buildCompetitionRanks(input.players, disciplineId));
  });

  const players: MarketValueFixtureResult[] = input.players.map((player) => {
    const disciplineRanks: Record<string, number> = {};
    const disciplineMarketValues: Record<string, number> = {};

    disciplineIds.forEach((disciplineId) => {
      const rank = rankMaps.get(disciplineId)?.get(player.playerId);
      if (rank == null) {
        return;
      }
      disciplineRanks[disciplineId] = rank;
      const mappedValue = mapRankToDisciplineMarketValue(rank, input.rankToDisciplineMarketValue!);
      if (mappedValue != null) {
        disciplineMarketValues[disciplineId] = mappedValue;
      }
    });

    const rawDisciplineMarketValueSum = roundTo2(
      Object.values(disciplineMarketValues).reduce((sum, value) => sum + value, 0),
    );
    const adjustedRaw = roundTo2(rawDisciplineMarketValueSum + (player.mwChangeFix ?? 0));
    const protectedRaw = roundTo2(Math.max(0, adjustedRaw));
    const calcWithoutBaseOffset = protectedRaw;
    const marketValueBaseOffset = MARKET_VALUE_BASE_OFFSET;
    const marketValueNew = roundTo2(protectedRaw + marketValueBaseOffset);

    return {
      playerId: player.playerId,
      disciplineRanks,
      disciplineMarketValues,
      rawDisciplineMarketValueSum,
      adjustedRaw,
      protectedRaw,
      marketValueBaseOffset,
      calcWithoutBaseOffset,
      marketValueNew,
    };
  });

  return {
    status: "ready",
    players,
    warnings: [],
  };
}
