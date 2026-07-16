import type {
  Discipline,
  LineupDisciplineSide,
  Matchday,
  Season,
  SeasonDisciplineScheduleEntry,
  SeasonDisciplineScheduleSourceStatus,
  Team,
} from "@/lib/data/olyDataTypes";

export const SEASON_CAPTAIN_SLOTS = 3;

export type LineupContractSourceStatus =
  | "mapped"
  | "mapped_with_transform"
  | "missing_source"
  | "blocked_formula_unclear"
  | "legacy_not_ported";

export type LineupDisciplineContractEntry = {
  disciplineId: string;
  displayName: string;
  order: number | null;
  requiredPlayers: number | null;
  requiredCaptains: number;
  category: "power" | "speed" | "mental" | "social";
  scoringField: string;
  rankSource: string | null;
  rankSourceStatus: LineupContractSourceStatus;
  isSupported: boolean;
  sourceStatus: LineupContractSourceStatus;
};

export type MatchdayDisciplineSlotContract = {
  disciplineId: string;
  displayName: string;
  order: number | null;
  requiredPlayers: number | null;
  requiredCaptains: number;
  category: "power" | "speed" | "mental" | "social";
  scoringField: string;
  rankSource: string | null;
  rankSourceStatus: LineupContractSourceStatus;
  sourceStatus: LineupContractSourceStatus;
  disciplineSide: LineupDisciplineSide;
};

function normalizeDisciplineRankField(disciplineId: string) {
  const value = String(disciplineId ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    "speed-schach": "schach",
    "mini-dm": "mini_dm",
    "time-trial": "time_trial",
    "takeshis-castle": "takeshi",
    "i-spy": "i_spy",
    eiskunstlauf: "eiskunst",
  };
  return map[value] ?? value.replace(/\s+/g, "_").replace(/-/g, "_");
}

export type MatchdayLineupContract = {
  matchdayId: string;
  matchdayLabel: string;
  matchdayIndex: number;
  sourceStatus: SeasonDisciplineScheduleSourceStatus;
  sourceNote: string | null;
  discipline1: MatchdayDisciplineSlotContract | null;
  discipline2: MatchdayDisciplineSlotContract | null;
  seasonCaptainSlots: number;
  totalDisciplineSidesInSeason: number;
};

export function buildLineupDisciplineContract(disciplines: Discipline[]): LineupDisciplineContractEntry[] {
  return [...disciplines]
    .sort((left, right) => {
      const leftOrder = left.displayOrder ?? left.originalOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.displayOrder ?? right.originalOrder ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.name.localeCompare(right.name, "de");
    })
    .map((discipline) => ({
      disciplineId: discipline.id,
      displayName: discipline.name,
      order: discipline.displayOrder ?? discipline.originalOrder ?? null,
      requiredPlayers: discipline.playerCount ?? null,
      requiredCaptains: 0,
      category: discipline.category,
      scoringField: discipline.id,
      rankSource: "active_roster_top6_sum_discipline_score",
      rankSourceStatus: "mapped_with_transform",
      isSupported: typeof discipline.playerCount === "number" && discipline.playerCount > 0,
      sourceStatus:
        typeof discipline.playerCount === "number" && discipline.playerCount > 0 ? "mapped" : "missing_source",
    }));
}

export function buildMatchdayLineupContract(input: {
  season: Season;
  matchday: Matchday;
  disciplines: Discipline[];
  disciplineSchedule?: SeasonDisciplineScheduleEntry[];
}): MatchdayLineupContract {
  const ordered = buildLineupDisciplineContract(input.disciplines);
  const hasStoredSchedule = Boolean(input.disciplineSchedule && input.disciplineSchedule.length > 0);
  const scheduledEntry = input.disciplineSchedule?.find((entry) => entry.matchdayId === input.matchday.id) ?? null;
  const fallbackBaseIndex = Math.max(0, input.matchday.index - 1) * 2;
  const scheduledDiscipline1 = scheduledEntry?.discipline1
    ? ordered.find((entry) => entry.disciplineId === scheduledEntry.discipline1?.disciplineId) ?? null
    : null;
  const scheduledDiscipline2 = scheduledEntry?.discipline2
    ? ordered.find((entry) => entry.disciplineId === scheduledEntry.discipline2?.disciplineId) ?? null
    : null;
  const resolvedDiscipline1 = hasStoredSchedule ? scheduledDiscipline1 : ordered[fallbackBaseIndex] ?? null;
  const resolvedDiscipline2 = hasStoredSchedule ? scheduledDiscipline2 : ordered[fallbackBaseIndex + 1] ?? null;
  const sourceStatus =
    hasStoredSchedule && !scheduledEntry
      ? "discipline_schedule_rule_missing"
      : scheduledEntry?.sourceStatus ?? "legacy_seed";
  const sourceNote =
    hasStoredSchedule && !scheduledEntry
      ? `Stored season discipline schedule has no entry for ${input.matchday.id}; fallback pairing stays blocked.`
      : scheduledEntry?.sourceNote ?? null;

  const toSlot = (
    discipline: LineupDisciplineContractEntry | null,
    disciplineSide: LineupDisciplineSide,
    scheduleSlot: SeasonDisciplineScheduleEntry["discipline1"],
  ): MatchdayDisciplineSlotContract | null =>
    discipline
      ? {
          disciplineId: discipline.disciplineId,
          displayName: scheduleSlot?.displayName ?? discipline.displayName,
          order: scheduleSlot?.order ?? discipline.order,
          requiredPlayers: scheduleSlot?.playerCount ?? discipline.requiredPlayers,
          requiredCaptains: discipline.requiredCaptains,
          category: scheduleSlot?.category ?? discipline.category,
          scoringField: discipline.scoringField,
          rankSource: discipline.rankSource ?? normalizeDisciplineRankField(discipline.disciplineId),
          rankSourceStatus: discipline.rankSourceStatus,
          sourceStatus: discipline.sourceStatus,
          disciplineSide,
        }
      : null;

  return {
    matchdayId: input.matchday.id,
    matchdayLabel: input.matchday.label,
    matchdayIndex: input.matchday.index,
    sourceStatus,
    sourceNote,
    discipline1: toSlot(resolvedDiscipline1, "d1", scheduledEntry?.discipline1 ?? null),
    discipline2: toSlot(resolvedDiscipline2, "d2", scheduledEntry?.discipline2 ?? null),
    seasonCaptainSlots: SEASON_CAPTAIN_SLOTS,
    totalDisciplineSidesInSeason:
      input.disciplineSchedule?.length != null && input.disciplineSchedule.length > 0
        ? input.disciplineSchedule.reduce(
            (total, entry) => total + (entry.discipline1 ? 1 : 0) + (entry.discipline2 ? 1 : 0),
            0,
          )
        : ordered.length,
  };
}

export function createLineupDraftId(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
}) {
  return `legacy-lineup:${input.saveId}:${input.seasonId}:${input.matchdayId}:${input.teamId}`;
}

export function countSeasonLineupDisciplineSides(input: {
  lineups: Array<{ teamId: string; seasonId: string; entries: Array<{ disciplineId: string; disciplineSide: LineupDisciplineSide }> }>;
  teamId: string;
  seasonId: string;
}) {
  const keys = new Set<string>();
  for (const draft of input.lineups) {
    if (draft.teamId !== input.teamId || draft.seasonId !== input.seasonId) {
      continue;
    }
    for (const entry of draft.entries) {
      keys.add(`${entry.disciplineId}::${entry.disciplineSide}`);
    }
  }
  return keys.size;
}

export function countSeasonCaptains(input: {
  lineups: Array<{ teamId: string; seasonId: string; entries: Array<{ disciplineId: string; disciplineSide: LineupDisciplineSide; isCaptain?: boolean }> }>;
  teamId: string;
  seasonId: string;
}) {
  return getSeasonCaptainDisciplineSideKeys(input).size;
}

export function getSeasonCaptainDisciplineSideKeys(input: {
  lineups: Array<{ teamId: string; seasonId: string; entries: Array<{ disciplineId: string; disciplineSide: LineupDisciplineSide; isCaptain?: boolean }> }>;
  teamId: string;
  seasonId: string;
}) {
  const keys = new Set<string>();
  for (const draft of input.lineups) {
    if (draft.teamId !== input.teamId || draft.seasonId !== input.seasonId) {
      continue;
    }
    for (const entry of draft.entries) {
      if (entry.isCaptain) {
        keys.add(`${entry.disciplineId}::${entry.disciplineSide}`);
      }
    }
  }
  return keys;
}

export function formatLineupTeamStatusLabel(input: {
  team: Pick<Team, "shortCode" | "name">;
  lineupFilledCount: number;
  totalLineupSides: number;
  captainUsedCount: number;
  captainSlots?: number;
}) {
  const captainSlots = input.captainSlots ?? SEASON_CAPTAIN_SLOTS;
  return `${input.team.shortCode} (${input.team.name}) · Lineup ${input.lineupFilledCount}/${input.totalLineupSides} · Captain ${input.captainUsedCount}/${captainSlots}`;
}
