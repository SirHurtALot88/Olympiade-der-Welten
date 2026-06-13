import type {
  MarketValueBonusBreakdown,
  MarketValueDisciplineInput,
  MarketValueEngineResult,
  MarketValueFixtureResult,
  RankToDisciplineMarketValueRow,
} from "@/lib/player-formulas/player-formula-types";

function roundTo2(value: number) {
  return Number(value.toFixed(2));
}

export const MARKET_VALUE_BASE_OFFSET = 3.5;

const ALLROUNDER_THRESHOLDS = [
  { threshold: 90, bonus: 2.2 },
  { threshold: 80, bonus: 1.4 },
  { threshold: 70, bonus: 0.8 },
  { threshold: 60, bonus: 0.4 },
  { threshold: 50, bonus: 0.15 },
] as const;

const SPECIALIST_BASELINES = {
  20: 20,
  40: 15,
  60: 10,
  80: 5,
} as const;

const SPECIALIST_DYNAMIC_RATES = {
  20: 0.0002,
  40: 0.001,
  60: 0.0025,
  80: 0.005,
} as const;

const SPECIALIST_FIXED_BONUS = {
  20: 0,
  40: 0,
  60: 0.15,
  80: 0.3,
} as const;

function mapRankToDisciplineMarketValue(rank: number, table: RankToDisciplineMarketValueRow[]) {
  return table.find((entry) => entry.rank === rank)?.disciplineMarketValue ?? null;
}

function countRatingsAboveThreshold(values: number[], threshold: number) {
  return values.filter((value) => value > threshold).length;
}

export function calculateAllrounderBonus(coreStats: {
  pow?: number | null;
  spe?: number | null;
  men?: number | null;
  soc?: number | null;
}) {
  const values = [coreStats.pow, coreStats.spe, coreStats.men, coreStats.soc];
  return roundTo2(
    values.reduce<number>((sum, rawValue) => {
      const value = typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : null;
      if (value == null) {
        return sum;
      }
      const match = ALLROUNDER_THRESHOLDS.find((entry) => value > entry.threshold);
      return sum + (match?.bonus ?? 0);
    }, 0),
  );
}

export function calculateMarketValueBonuses(input: {
  baseMarketValue: number;
  coreStats?: {
    pow?: number | null;
    spe?: number | null;
    men?: number | null;
    soc?: number | null;
  } | null;
  disciplineRatings?: Record<string, number | null | undefined> | null;
}): MarketValueBonusBreakdown {
  const disciplineValues = Object.values(input.disciplineRatings ?? {}).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  const over20 = countRatingsAboveThreshold(disciplineValues, 20);
  const over40 = countRatingsAboveThreshold(disciplineValues, 40);
  const over60 = countRatingsAboveThreshold(disciplineValues, 60);
  const over80 = countRatingsAboveThreshold(disciplineValues, 80);
  const over20Excess = Math.max(0, over20 - SPECIALIST_BASELINES[20]);
  const over40Excess = Math.max(0, over40 - SPECIALIST_BASELINES[40]);
  const over60Excess = Math.max(0, over60 - SPECIALIST_BASELINES[60]);
  const over80Excess = Math.max(0, over80 - SPECIALIST_BASELINES[80]);
  const allrounderBonus = calculateAllrounderBonus(input.coreStats ?? {});
  const specialistDynamicBase = input.baseMarketValue + allrounderBonus;
  const fixedSpecialistBonus = roundTo2(
    over20Excess * SPECIALIST_FIXED_BONUS[20] +
      over40Excess * SPECIALIST_FIXED_BONUS[40] +
      over60Excess * SPECIALIST_FIXED_BONUS[60] +
      over80Excess * SPECIALIST_FIXED_BONUS[80],
  );
  const dynamicRateTotal =
    over20Excess * SPECIALIST_DYNAMIC_RATES[20] +
    over40Excess * SPECIALIST_DYNAMIC_RATES[40] +
    over60Excess * SPECIALIST_DYNAMIC_RATES[60] +
    over80Excess * SPECIALIST_DYNAMIC_RATES[80];
  const specialistBonus = roundTo2(fixedSpecialistBonus + specialistDynamicBase * dynamicRateTotal);

  return {
    over20,
    over40,
    over60,
    over80,
    over20Excess,
    over40Excess,
    over60Excess,
    over80Excess,
    dynamicRateTotal,
    fixedSpecialistBonus,
    allrounderBonus,
    specialistBonus,
  };
}

export function deriveBaseMarketValueFromFinal(input: {
  finalMarketValue: number;
  coreStats?: {
    pow?: number | null;
    spe?: number | null;
    men?: number | null;
    soc?: number | null;
  } | null;
  disciplineRatings?: Record<string, number | null | undefined> | null;
}) {
  const provisional = calculateMarketValueBonuses({
    baseMarketValue: 0,
    coreStats: input.coreStats,
    disciplineRatings: input.disciplineRatings,
  });
  const dynamicRate = provisional.dynamicRateTotal;
  const baseMarketValue = roundTo2(
    ((input.finalMarketValue - provisional.fixedSpecialistBonus) / (1 + dynamicRate)) - provisional.allrounderBonus,
  );
  return Math.max(0, baseMarketValue);
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
