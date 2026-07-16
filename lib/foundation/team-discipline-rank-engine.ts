import type { Discipline, GameState, Team, TeamDisciplineRankSnapshotRecord } from "@/lib/data/olyDataTypes";
import { buildSharedRankMap, roundViewNumber } from "@/lib/foundation/tabs/season-stand-render-helpers";

export type TeamDisciplineRankScorePack = {
  total: number;
  pow: number;
  spe: number;
  men: number;
  soc: number;
  disciplines: Record<string, number>;
};

export type TeamDisciplineRankRowCore = {
  teamId: string;
  teamCode: string | null;
  teamName: string;
  totalRank: number;
  powRank: number;
  speRank: number;
  menRank: number;
  socRank: number;
  disciplineRanks: Record<string, number>;
  scorePack: TeamDisciplineRankScorePack;
};

export type TeamDisciplineRankDeltaPack = {
  total: number | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
};

export function resolvePreviousSeasonId(seasonId: string): string | null {
  const seasonNumber = Number(seasonId.match(/(\d+)$/)?.[1] ?? 1);
  if (seasonNumber <= 1) {
    return null;
  }
  return `season-${seasonNumber - 1}`;
}

export function computeTeamDisciplineRankDelta(
  previousRank: number | null | undefined,
  currentRank: number,
): number | null {
  if (!previousRank || previousRank <= 0 || currentRank <= 0) {
    return null;
  }
  const delta = previousRank - currentRank;
  return delta === 0 ? null : delta;
}

export function buildTeamDisciplineRankDeltaPack(
  current: Pick<TeamDisciplineRankRowCore, "totalRank" | "powRank" | "speRank" | "menRank" | "socRank" | "scorePack">,
  previous:
    | Pick<TeamDisciplineRankSnapshotRecord, "totalRank" | "powRank" | "speRank" | "menRank" | "socRank">
    | null
    | undefined,
): TeamDisciplineRankDeltaPack {
  if (!previous) {
    return { total: null, pow: null, spe: null, men: null, soc: null };
  }

  return {
    total: computeTeamDisciplineRankDelta(previous.totalRank, current.totalRank),
    pow:
      current.scorePack.pow > 0
        ? computeTeamDisciplineRankDelta(previous.powRank, current.powRank)
        : null,
    spe:
      current.scorePack.spe > 0
        ? computeTeamDisciplineRankDelta(previous.speRank, current.speRank)
        : null,
    men:
      current.scorePack.men > 0
        ? computeTeamDisciplineRankDelta(previous.menRank, current.menRank)
        : null,
    soc:
      current.scorePack.soc > 0
        ? computeTeamDisciplineRankDelta(previous.socRank, current.socRank)
        : null,
  };
}

function buildEmptyScorePack(orderedDisciplines: Discipline[]): TeamDisciplineRankScorePack {
  return {
    total: 0,
    pow: 0,
    spe: 0,
    men: 0,
    soc: 0,
    disciplines: Object.fromEntries(orderedDisciplines.map((discipline) => [discipline.id, 0] as const)),
  };
}

export function buildTeamDisciplineRankRowsFromGameState(
  gameState: GameState,
  orderedDisciplines: Discipline[],
): TeamDisciplineRankRowCore[] {
  const rosterByTeamId = new Map<string, Array<(typeof gameState.players)[number]>>();
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));

  for (const team of gameState.teams) {
    rosterByTeamId.set(team.teamId, []);
  }

  for (const rosterEntry of gameState.rosters) {
    const player = playerById.get(rosterEntry.playerId);
    if (!player) {
      continue;
    }
    const current = rosterByTeamId.get(rosterEntry.teamId) ?? [];
    current.push(player);
    rosterByTeamId.set(rosterEntry.teamId, current);
  }

  const computeTopSixDisciplineSum = (teamId: string, disciplineId: string) => {
    const values = (rosterByTeamId.get(teamId) ?? [])
      .map((player) => player.disciplineRatings[disciplineId] ?? 0)
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((left, right) => right - left)
      .slice(0, 6);

    if (values.length === 0) {
      return 0;
    }

    return roundViewNumber(values.reduce((sum, value) => sum + value, 0), 2);
  };

  const disciplineScoresByTeam = new Map<string, TeamDisciplineRankScorePack>();

  for (const team of gameState.teams) {
    const disciplineScores = Object.fromEntries(
      orderedDisciplines.map((discipline) => [
        discipline.id,
        computeTopSixDisciplineSum(team.teamId, discipline.id),
      ]),
    );
    const pow = roundViewNumber(
      orderedDisciplines
        .filter((discipline) => discipline.category === "power")
        .reduce((sum, discipline) => sum + (disciplineScores[discipline.id] ?? 0), 0),
      2,
    );
    const spe = roundViewNumber(
      orderedDisciplines
        .filter((discipline) => discipline.category === "speed")
        .reduce((sum, discipline) => sum + (disciplineScores[discipline.id] ?? 0), 0),
      2,
    );
    const men = roundViewNumber(
      orderedDisciplines
        .filter((discipline) => discipline.category === "mental")
        .reduce((sum, discipline) => sum + (disciplineScores[discipline.id] ?? 0), 0),
      2,
    );
    const soc = roundViewNumber(
      orderedDisciplines
        .filter((discipline) => discipline.category === "social")
        .reduce((sum, discipline) => sum + (disciplineScores[discipline.id] ?? 0), 0),
      2,
    );
    const total = roundViewNumber(
      orderedDisciplines.reduce((sum, discipline) => sum + (disciplineScores[discipline.id] ?? 0), 0),
      2,
    );

    disciplineScoresByTeam.set(team.teamId, {
      total,
      pow,
      spe,
      men,
      soc,
      disciplines: disciplineScores,
    });
  }

  const totalRankMap = buildSharedRankMap(
    gameState.teams.map((team) => ({
      teamId: team.teamId,
      value: disciplineScoresByTeam.get(team.teamId)?.total ?? 0,
    })),
  );
  const powRankMap = buildSharedRankMap(
    gameState.teams.map((team) => ({
      teamId: team.teamId,
      value: disciplineScoresByTeam.get(team.teamId)?.pow ?? 0,
    })),
  );
  const speRankMap = buildSharedRankMap(
    gameState.teams.map((team) => ({
      teamId: team.teamId,
      value: disciplineScoresByTeam.get(team.teamId)?.spe ?? 0,
    })),
  );
  const menRankMap = buildSharedRankMap(
    gameState.teams.map((team) => ({
      teamId: team.teamId,
      value: disciplineScoresByTeam.get(team.teamId)?.men ?? 0,
    })),
  );
  const socRankMap = buildSharedRankMap(
    gameState.teams.map((team) => ({
      teamId: team.teamId,
      value: disciplineScoresByTeam.get(team.teamId)?.soc ?? 0,
    })),
  );

  const disciplineRankMaps = new Map(
    orderedDisciplines.map((discipline) => [
      discipline.id,
      buildSharedRankMap(
        gameState.teams.map((team) => ({
          teamId: team.teamId,
          value: disciplineScoresByTeam.get(team.teamId)?.disciplines[discipline.id] ?? 0,
        })),
      ),
    ]),
  );

  return [...gameState.teams]
    .map((team) => {
      const scorePack = disciplineScoresByTeam.get(team.teamId) ?? buildEmptyScorePack(orderedDisciplines);
      const disciplineRanks = Object.fromEntries(
        orderedDisciplines.map((discipline) => [
          discipline.id,
          disciplineRankMaps.get(discipline.id)?.get(team.teamId) ?? 0,
        ]),
      );

      return {
        teamId: team.teamId,
        teamCode: team.shortCode ?? null,
        teamName: team.name,
        totalRank: totalRankMap.get(team.teamId) ?? 0,
        powRank: powRankMap.get(team.teamId) ?? 0,
        speRank: speRankMap.get(team.teamId) ?? 0,
        menRank: menRankMap.get(team.teamId) ?? 0,
        socRank: socRankMap.get(team.teamId) ?? 0,
        disciplineRanks,
        scorePack,
      };
    })
    .sort((left, right) => {
      if (left.totalRank !== right.totalRank) {
        return left.totalRank - right.totalRank;
      }
      return left.teamName.localeCompare(right.teamName, "de");
    });
}

export function buildTeamDisciplineRankSnapshotRecords(
  gameState: GameState,
  orderedDisciplines: Discipline[] = gameState.disciplines,
): TeamDisciplineRankSnapshotRecord[] {
  return buildTeamDisciplineRankRowsFromGameState(gameState, orderedDisciplines).map((row) => ({
    teamId: row.teamId,
    teamCode: row.teamCode,
    teamName: row.teamName,
    totalRank: row.totalRank,
    powRank: row.powRank,
    speRank: row.speRank,
    menRank: row.menRank,
    socRank: row.socRank,
    disciplineRanks: row.disciplineRanks,
    scorePack: row.scorePack,
  }));
}

export function buildTeamDisciplineRankRowsFromSnapshotRecords(
  snapshotRecords: TeamDisciplineRankSnapshotRecord[],
  teamsById: Map<string, Team>,
  orderedDisciplines: Discipline[],
): TeamDisciplineRankRowCore[] {
  return [...snapshotRecords]
    .map((record) => {
      const team = teamsById.get(record.teamId);
      const scorePack: TeamDisciplineRankScorePack = record.scorePack
        ? {
            ...record.scorePack,
            disciplines:
              record.scorePack.disciplines ??
              Object.fromEntries(orderedDisciplines.map((discipline) => [discipline.id, 0] as const)),
          }
        : buildEmptyScorePack(orderedDisciplines);
      const disciplineRanks =
        record.disciplineRanks ??
        Object.fromEntries(orderedDisciplines.map((discipline) => [discipline.id, 0] as const));

      return {
        teamId: record.teamId,
        teamCode: record.teamCode ?? team?.shortCode ?? null,
        teamName: record.teamName ?? team?.name ?? record.teamId,
        totalRank: record.totalRank,
        powRank: record.powRank,
        speRank: record.speRank,
        menRank: record.menRank,
        socRank: record.socRank,
        disciplineRanks,
        scorePack,
      };
    })
    .sort((left, right) => {
      if (left.totalRank !== right.totalRank) {
        return left.totalRank - right.totalRank;
      }
      return left.teamName.localeCompare(right.teamName, "de");
    });
}

export function buildPreviousTeamDisciplineRankLookup(
  snapshots: Array<{ seasonId: string; teamDisciplineRankSnapshots?: TeamDisciplineRankSnapshotRecord[] }>,
  seasonId: string,
): Map<string, TeamDisciplineRankSnapshotRecord> {
  const previousSeasonId = resolvePreviousSeasonId(seasonId);
  if (!previousSeasonId) {
    return new Map();
  }

  const previousSnapshot = snapshots.find((entry) => entry.seasonId === previousSeasonId);
  const records = previousSnapshot?.teamDisciplineRankSnapshots ?? [];
  return new Map(records.map((record) => [record.teamId, record] as const));
}
