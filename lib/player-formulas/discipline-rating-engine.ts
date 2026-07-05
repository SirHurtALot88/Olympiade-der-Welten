import type { Discipline, Player, PlayerGeneratorAttributes, PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import { foundationSeedDisciplines } from "@/lib/data/dataAdapter";
import {
  officialDisciplineWeightOrder,
  officialDisciplineWeightTable,
  type OfficialDisciplineWeightId,
} from "@/lib/player-generator/official-discipline-weights";
import rankToDisciplineStatJson from "@/references/formulas/rank-to-discipline-stat.json";

export type RankToDisciplineStatRow = {
  rank: number;
  disciplineStat: number;
};

const rankToDisciplineStatTable = rankToDisciplineStatJson as RankToDisciplineStatRow[];

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Weighted attribute sum used for league-wide discipline ranking (not divided by weight sum). */
export function calculateRawDisciplineScore(
  attributes: PlayerGeneratorAttributes,
  disciplineId: OfficialDisciplineWeightId,
) {
  let weighted = 0;
  let hasWeight = false;
  for (const [attribute, weights] of Object.entries(officialDisciplineWeightTable)) {
    const weight = weights[disciplineId];
    if (weight <= 0) continue;
    hasWeight = true;
    weighted += attributes[attribute as PlayerGeneratorAttributeName] * weight;
  }
  return hasWeight ? weighted : null;
}

export function mapRankToDisciplineStat(rank: number, table: RankToDisciplineStatRow[] = rankToDisciplineStatTable) {
  if (!Number.isFinite(rank) || rank < 1) return null;
  const roundedRank = Math.max(1, Math.round(rank));
  return table.find((entry) => entry.rank === roundedRank)?.disciplineStat ?? null;
}

export function buildCompetitionRanks(
  entries: Array<{ playerId: string; score: number | null }>,
) {
  const ranked = [...entries]
    .filter((entry): entry is { playerId: string; score: number } => entry.score != null && Number.isFinite(entry.score))
    .sort((left, right) => right.score - left.score);

  const rankMap = new Map<string, number>();
  let currentRank = 1;

  ranked.forEach((entry, index) => {
    if (index > 0) {
      const previous = ranked[index - 1];
      if (previous && entry.score !== previous.score) {
        currentRank = index + 1;
      }
    }
    rankMap.set(entry.playerId, currentRank);
  });

  return rankMap;
}

function readPlayerAttributes(player: Player): PlayerGeneratorAttributes | null {
  const stats = player.attributeSheetStats;
  if (!stats) return null;
  const attributes = {
    power: stats.power,
    health: stats.health,
    stamina: stats.stamina,
    intelligence: stats.intelligence,
    awareness: stats.awareness,
    determination: stats.determination,
    speed: stats.speed,
    dexterity: stats.dexterity,
    charisma: stats.charisma,
    will: stats.will,
    spirit: stats.spirit,
    torment: stats.torment,
  };
  return Object.values(attributes).every(isFiniteNumber) ? attributes : null;
}

export function buildLeagueDisciplineRatingsWithAttributeOverrides(
  players: Player[],
  attributeOverridesByPlayerId: ReadonlyMap<string, PlayerGeneratorAttributes> | Record<string, PlayerGeneratorAttributes> = {},
  table: RankToDisciplineStatRow[] = rankToDisciplineStatTable,
): Map<string, Record<string, number>> {
  const overrides =
    attributeOverridesByPlayerId instanceof Map
      ? attributeOverridesByPlayerId
      : new Map(Object.entries(attributeOverridesByPlayerId));
  const playerAttributes = new Map<string, PlayerGeneratorAttributes>();

  for (const player of players) {
    const override = overrides.get(player.id);
    const attributes = override ?? readPlayerAttributes(player);
    if (attributes) {
      playerAttributes.set(player.id, attributes);
    }
  }

  return buildLeagueDisciplineRatingsFromAttributeMap(players, playerAttributes, table);
}

function buildLeagueDisciplineRatingsFromAttributeMap(
  players: Player[],
  playerAttributes: Map<string, PlayerGeneratorAttributes>,
  table: RankToDisciplineStatRow[],
) {
  const ratingsByPlayerId = new Map<string, Record<string, number>>();

  for (const disciplineId of officialDisciplineWeightOrder) {
    const rankMap = buildCompetitionRanks(
      players.map((player) => ({
        playerId: player.id,
        score: playerAttributes.has(player.id)
          ? calculateRawDisciplineScore(playerAttributes.get(player.id)!, disciplineId)
          : null,
      })),
    );

    for (const [playerId, rank] of rankMap.entries()) {
      const stat = mapRankToDisciplineStat(rank, table);
      if (stat == null) continue;
      const nextRatings = ratingsByPlayerId.get(playerId) ?? {};
      nextRatings[disciplineId] = roundValue(stat, 2);
      ratingsByPlayerId.set(playerId, nextRatings);
    }
  }

  return ratingsByPlayerId;
}

/** Raw weighted attribute sums per discipline (same ranking input as discipline stats). */
export function buildRawDisciplineScoresByPlayerId(
  players: Player[],
  attributeOverridesByPlayerId: ReadonlyMap<string, PlayerGeneratorAttributes> | Record<string, PlayerGeneratorAttributes> = {},
): Map<string, Record<string, number>> {
  const overrides =
    attributeOverridesByPlayerId instanceof Map
      ? attributeOverridesByPlayerId
      : new Map(Object.entries(attributeOverridesByPlayerId));
  const playerAttributes = new Map<string, PlayerGeneratorAttributes>();

  for (const player of players) {
    const override = overrides.get(player.id);
    const attributes = override ?? readPlayerAttributes(player);
    if (attributes) {
      playerAttributes.set(player.id, attributes);
    }
  }

  const scoresByPlayerId = new Map<string, Record<string, number>>();
  for (const player of players) {
    const attributes = playerAttributes.get(player.id);
    if (!attributes) continue;
    const scores: Record<string, number> = {};
    for (const disciplineId of officialDisciplineWeightOrder) {
      const score = calculateRawDisciplineScore(attributes, disciplineId);
      if (score != null) {
        scores[disciplineId] = score;
      }
    }
    if (Object.keys(scores).length > 0) {
      scoresByPlayerId.set(player.id, scores);
    }
  }

  return scoresByPlayerId;
}

/** Rebuild displayed discipline stats for all players via league rank → stat table. */
export function buildLeagueDisciplineRatingsForPlayers(
  players: Player[],
  table: RankToDisciplineStatRow[] = rankToDisciplineStatTable,
): Map<string, Record<string, number>> {
  return buildLeagueDisciplineRatingsWithAttributeOverrides(players, {}, table);
}

function buildCoreStatsFromDisciplineRatings(
  disciplineRatings: Record<string, number>,
  fallback: Player["coreStats"],
  disciplines: Discipline[] = foundationSeedDisciplines,
): Player["coreStats"] {
  const axisByCategory = {
    power: "pow",
    speed: "spe",
    mental: "men",
    social: "soc",
  } as const;
  const next = { ...fallback };
  for (const [category, axis] of Object.entries(axisByCategory) as Array<
    [keyof typeof axisByCategory, (typeof axisByCategory)[keyof typeof axisByCategory]]
  >) {
    const values = disciplines
      .filter((discipline) => discipline.category === category)
      .map((discipline) => disciplineRatings[discipline.id])
      .filter(isFiniteNumber);
    if (values.length > 0) {
      next[axis] = roundValue(values.reduce((sum, value) => sum + value, 0) / values.length, 2);
    }
  }
  return next;
}

export function applyLeagueDisciplineRatingsToPlayer(
  player: Player,
  ratingsByPlayerId: Map<string, Record<string, number>>,
): Player {
  const disciplineRatings = ratingsByPlayerId.get(player.id);
  if (!disciplineRatings) return player;
  const values = Object.values(disciplineRatings);
  const rating = values.length ? roundValue(values.reduce((sum, value) => sum + value, 0) / values.length, 2) : player.rating;
  return {
    ...player,
    disciplineRatings,
    coreStats: buildCoreStatsFromDisciplineRatings(disciplineRatings, player.coreStats),
    preferredDisciplineIds:
      player.preferredDisciplineIds.length > 0
        ? player.preferredDisciplineIds
        : Object.entries(disciplineRatings)
            .sort((left, right) => right[1] - left[1])
            .slice(0, 3)
            .map(([disciplineId]) => disciplineId),
    disciplineTierCounts: {
      above20: values.filter((value) => value > 20).length,
      above40: values.filter((value) => value > 40).length,
      above60: values.filter((value) => value > 60).length,
      above80: values.filter((value) => value > 80).length,
    },
    rating: player.rating > 0 ? player.rating : rating,
  };
}

export function rebuildLeagueDisciplineRatings(players: Player[]): Player[] {
  const ratingsByPlayerId = buildLeagueDisciplineRatingsForPlayers(players);
  return players.map((player) => applyLeagueDisciplineRatingsToPlayer(player, ratingsByPlayerId));
}
