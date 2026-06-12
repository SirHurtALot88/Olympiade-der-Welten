export type TeamDisciplineRankSourceStatus =
  | "mapped"
  | "mapped_with_transform"
  | "missing_source"
  | "blocked_formula_unclear"
  | "legacy_not_ported";

export type TeamDisciplineRankEntry = {
  rank: number | null;
  score: number | null;
  sourceStatus: TeamDisciplineRankSourceStatus;
  rankSource: string | null;
};

type TeamPlayerAssignment = {
  teamId: string;
  playerId: string;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function topKSum(values: number[], count: number) {
  const sorted = [...values]
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => right - left);

  if (sorted.length === 0) {
    return null;
  }

  const slice = sorted.slice(0, Math.max(1, count));
  return roundValue(slice.reduce((sum, value) => sum + value, 0), 2);
}

export function normalizeLineupDisciplineFieldName(input: string) {
  const value = String(input ?? "").trim().toLowerCase();
  if (!value) {
    return "";
  }

  const map: Record<string, string> = {
    "speed-schach": "schach",
    "speed schach": "schach",
    schach: "schach",
    "mini-dm": "mini_dm",
    "mini dm": "mini_dm",
    mini_dm: "mini_dm",
    "time-trial": "time_trial",
    "time trial": "time_trial",
    time_trial: "time_trial",
    "takeshis-castle": "takeshi",
    "takeshis castle": "takeshi",
    takeshi: "takeshi",
    "i-spy": "i_spy",
    "i spy": "i_spy",
    i_spy: "i_spy",
    eiskunstlauf: "eiskunst",
    eiskunst: "eiskunst",
  };

  return map[value] ?? value.replace(/\s+/g, "_").replace(/-/g, "_");
}

export function computeTeamDisciplineRanks(input: {
  teamId: string;
  teamIds: string[];
  disciplineIds: string[];
  rosterAssignments: TeamPlayerAssignment[];
  scoreByPlayerAndDiscipline: Map<string, number>;
  topPlayerCount?: number;
}): Record<string, TeamDisciplineRankEntry> {
  const disciplineIds = Array.from(new Set(input.disciplineIds.filter(Boolean)));
  const topPlayerCount = input.topPlayerCount ?? 6;
  const rosterByTeamId = new Map<string, string[]>();

  for (const assignment of input.rosterAssignments) {
    const current = rosterByTeamId.get(assignment.teamId) ?? [];
    current.push(assignment.playerId);
    rosterByTeamId.set(assignment.teamId, current);
  }

  const scoreByTeamAndDiscipline = new Map<string, number | null>();
  for (const teamId of input.teamIds) {
    const playerIds = rosterByTeamId.get(teamId) ?? [];
    for (const disciplineId of disciplineIds) {
      const values = playerIds.map((playerId) => input.scoreByPlayerAndDiscipline.get(`${playerId}::${disciplineId}`) ?? 0);
      scoreByTeamAndDiscipline.set(`${teamId}::${disciplineId}`, topKSum(values, topPlayerCount));
    }
  }

  return Object.fromEntries(
    disciplineIds.map((disciplineId) => {
      const ownScore = scoreByTeamAndDiscipline.get(`${input.teamId}::${disciplineId}`) ?? null;
      if (ownScore == null) {
        return [
          disciplineId,
          {
            rank: null,
            score: null,
            sourceStatus: "missing_source" as const,
            rankSource: null,
          },
        ] as const;
      }

      const ordered = input.teamIds
        .map((teamId) => ({
          teamId,
          score: scoreByTeamAndDiscipline.get(`${teamId}::${disciplineId}`) ?? null,
        }))
        .filter((entry): entry is { teamId: string; score: number } => entry.score != null)
        .sort((left, right) => right.score - left.score || left.teamId.localeCompare(right.teamId, "de"));

      return [
        disciplineId,
        {
          rank: ordered.findIndex((entry) => entry.teamId === input.teamId) + 1 || null,
          score: ownScore,
          sourceStatus: "mapped_with_transform" as const,
          rankSource: "active_roster_top6_sum_discipline_score",
        },
      ] as const;
    }),
  );
}
