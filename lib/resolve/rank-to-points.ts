import rankToPointsJson from "@/references/sheets/rank-to-points.json";
import type { GameState } from "@/lib/data/olyDataTypes";

type RankToPointsJsonRow = Record<string, string>;

export type RankToPointsSourceStatus =
  | "rank_to_points_final_score_share"
  | "rank_to_points_base_share_fallback"
  | "rank_to_points_score_share_fallback"
  | "rank_to_points_missing";

export type DistributedRankPointEntry<T> = {
  item: T;
  points: number | null;
};

export type DistributeRankPointsResult<T> = {
  teamPoints: number | null;
  pointSource: RankToPointsSourceStatus;
  entries: Array<DistributedRankPointEntry<T>>;
  warnings: string[];
};

type RankPointLookupRow = {
  playerCount: number;
  pointsByRank: Map<number, number>;
};

type RankToPointsJsonShape = {
  rows?: RankToPointsJsonRow[];
};

function roundValue(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseNumber(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildRankPointLookup() {
  const rows = ((rankToPointsJson as RankToPointsJsonShape).rows ?? [])
    .map<RankPointLookupRow | null>((row) => {
      const playerCount = parseNumber(row.Spieleranzahl);
      if (!isFiniteNumber(playerCount)) {
        return null;
      }

      const pointsByRank = new Map<number, number>();
      for (const [key, rawValue] of Object.entries(row)) {
        if (!/^\d+\.$/.test(key.trim())) {
          continue;
        }
        const rank = Number(key.replace(".", ""));
        const points = parseNumber(rawValue);
        if (!Number.isFinite(rank) || !isFiniteNumber(points)) {
          continue;
        }
        pointsByRank.set(rank, points);
      }

      return {
        playerCount,
        pointsByRank,
      };
    })
    .filter((row): row is RankPointLookupRow => row != null);

  return new Map(rows.map((row) => [row.playerCount, row.pointsByRank] as const));
}

const rankPointLookup = buildRankPointLookup();

function buildNormalizedWeights(values: number[], total: number) {
  const points = values.map((value) => roundValue((total * value) / values.reduce((sum, current) => sum + current, 0)));
  const currentTotal = roundValue(points.reduce((sum, value) => sum + value, 0));
  const delta = roundValue(total - currentTotal);
  if (points.length > 0 && delta !== 0) {
    points[points.length - 1] = roundValue((points[points.length - 1] ?? 0) + delta);
  }
  return points;
}

function distributeByValues<T>(
  entries: T[],
  total: number,
  valueAccessor: (entry: T) => number | null | undefined,
): Array<DistributedRankPointEntry<T>> | null {
  const values = entries.map((entry) => {
    const value = valueAccessor(entry);
    return isFiniteNumber(value) && value > 0 ? value : 0;
  });
  const valueTotal = values.reduce((sum, value) => sum + value, 0);
  if (valueTotal <= 0) {
    return null;
  }

  const distributed = buildNormalizedWeights(values, total);
  return entries.map((item, index) => ({
    item,
    points: distributed[index] ?? null,
  }));
}

export function getRankToPointsValue(playerCount: number | null | undefined, rank: number | null | undefined) {
  if (!isFiniteNumber(playerCount) || !isFiniteNumber(rank)) {
    return null;
  }

  return rankPointLookup.get(playerCount)?.get(rank) ?? null;
}

export function resolveDisciplinePlayerCount(
  gameState: Pick<GameState, "disciplines" | "seasonState">,
  input: {
    matchdayId: string | null;
    disciplineId: string;
    disciplineSide: "d1" | "d2";
  },
) {
  const scheduleRow = (gameState.seasonState.disciplineSchedule ?? []).find((entry) => entry.matchdayId === input.matchdayId);
  const scheduledDiscipline =
    input.disciplineSide === "d1" ? scheduleRow?.discipline1 : scheduleRow?.discipline2;

  if (scheduledDiscipline?.disciplineId === input.disciplineId && isFiniteNumber(scheduledDiscipline.playerCount)) {
    return scheduledDiscipline.playerCount;
  }

  const discipline = gameState.disciplines.find((entry) => entry.id === input.disciplineId);
  return isFiniteNumber(discipline?.playerCount) ? discipline.playerCount : null;
}

export function distributeRankPointsToPlayers<T extends {
  baseValue: number | null | undefined;
  finalPlayerScore: number | null | undefined;
  scoreContribution: number | null | undefined;
}>(
  input: {
    playerCount: number | null;
    rank: number | null;
    entries: T[];
  },
): DistributeRankPointsResult<T> {
  const warnings: string[] = [];
  const teamPoints = getRankToPointsValue(input.playerCount, input.rank);

  if (teamPoints == null) {
    warnings.push(
      `rank_to_points_missing:${input.playerCount ?? "unknown_player_count"}:${input.rank ?? "unknown_rank"}`,
    );
    return {
      teamPoints: null,
      pointSource: "rank_to_points_missing",
      entries: input.entries.map((item) => ({ item, points: null })),
      warnings,
    };
  }

  // Primär nach dem ENDSCORE (finalPlayerScore inkl. Fatigue/Moral/Form-Jitter)
  // verteilen: wer durch schlechte Form/Form-Jitter einen niedrigeren Endscore
  // hat, bekommt verhältnismäßig weniger Team-PP. (Früher: nach baseValue.)
  const finalScoreDistribution = distributeByValues(input.entries, teamPoints, (entry) => entry.finalPlayerScore);
  if (finalScoreDistribution) {
    return {
      teamPoints,
      pointSource: "rank_to_points_final_score_share",
      entries: finalScoreDistribution,
      warnings,
    };
  }

  const baseDistribution = distributeByValues(input.entries, teamPoints, (entry) => entry.baseValue);
  if (baseDistribution) {
    warnings.push("rank_to_points_used_base_share_fallback");
    return {
      teamPoints,
      pointSource: "rank_to_points_base_share_fallback",
      entries: baseDistribution,
      warnings,
    };
  }

  const scoreShareDistribution = distributeByValues(input.entries, teamPoints, (entry) => entry.scoreContribution);
  if (scoreShareDistribution) {
    warnings.push("rank_to_points_used_score_share_fallback");
    return {
      teamPoints,
      pointSource: "rank_to_points_score_share_fallback",
      entries: scoreShareDistribution,
      warnings,
    };
  }

  warnings.push("rank_to_points_player_distribution_missing");
  return {
    teamPoints,
    pointSource: "rank_to_points_missing",
    entries: input.entries.map((item) => ({ item, points: null })),
    warnings,
  };
}
