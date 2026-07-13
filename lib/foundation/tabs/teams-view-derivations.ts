import type { Team } from "@/lib/data/olyDataTypes";
import {
  sortFoundationTableRows,
  type FoundationTableSortState,
} from "@/lib/foundation/foundation-table-sort";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";

export type TeamsAreaRank = {
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
};

export type TeamsViewRow = TeamManagementSnapshotRow & {
  currentPowRank: number | null;
  currentSpeRank: number | null;
  currentMenRank: number | null;
  currentSocRank: number | null;
  overallRank: number | null;
  guv: number | null;
  sponsorTotal: number | null;
  avgSalary: number | null;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  avgRank: number | null;
  avgPoints: number | null;
  top5: number;
  top10: number;
};

export type TeamHistorySeasonPointColumn = {
  seasonId: string;
  seasonName: string;
};

export type TeamHistoryPointRankMaps = {
  total: Map<string, number | null>;
  average: Map<string, number | null>;
  bySeason: Map<string, Map<string, number | null>>;
};

export type TeamsViewSummary = TeamsViewRow & {
  powRank: number | null;
  speRank: number | null;
  menRank: number | null;
  socRank: number | null;
};

export type SelectedHqAxisSummary = {
  strongest: { label: "POW" | "SPE" | "MEN" | "SOC"; rank: number } | null;
  weakest: { label: "POW" | "SPE" | "MEN" | "SOC"; rank: number } | null;
  weakestTwo: Array<{ label: "POW" | "SPE" | "MEN" | "SOC"; rank: number }>;
};

export type DisciplineRankRowInput = {
  team: Team;
  scorePack: {
    pow: number;
    spe: number;
    men: number;
    soc: number;
  };
  powRank: number;
  speRank: number;
  menRank: number;
  socRank: number;
};

const EMPTY_TEAMS_VIEW_ROWS: TeamsViewRow[] = [];
const EMPTY_TEAM_HISTORY_COLUMNS: TeamHistorySeasonPointColumn[] = [];
const EMPTY_AREA_RANK_MAP = new Map<string, TeamsAreaRank>();
const EMPTY_TEAM_HISTORY_POINT_RANK_MAPS: TeamHistoryPointRankMaps = {
  total: new Map<string, number | null>(),
  average: new Map<string, number | null>(),
  bySeason: new Map<string, Map<string, number | null>>(),
};

export function shouldBuildTeamsView(activeView: string): boolean {
  return activeView === "teams";
}

export function resolveShouldBuildTeamsOverviewTable(
  activeView: string,
  selectedTeamDetailTab: "roster" | "contracts" | "portraits",
): boolean {
  return shouldBuildTeamsView(activeView) && selectedTeamDetailTab === "roster";
}

export function resolveShouldBuildTeamsPlayerRatings(input: {
  activeView: string;
  teamsHydrationPhase: "shell" | "full";
  selectedTeamDetailTab: "roster" | "contracts" | "portraits";
  shouldBuildTeamContracts: boolean;
  shouldBuildExtendedTeamPanels: boolean;
}): boolean {
  return (
    shouldBuildTeamsView(input.activeView) &&
    input.teamsHydrationPhase === "full" &&
    (input.selectedTeamDetailTab === "roster" ||
      input.selectedTeamDetailTab === "portraits" ||
      input.shouldBuildTeamContracts ||
      input.shouldBuildExtendedTeamPanels)
  );
}

/** Roster/contracts tabs only need ratings for the selected team's active roster (~15–20 players). */
export function resolveShouldBuildTeamsScopedRatings(
  activeView: string,
  selectedTeamDetailTab: "roster" | "contracts" | "portraits",
): boolean {
  return (
    shouldBuildTeamsView(activeView) &&
    (selectedTeamDetailTab === "roster" || selectedTeamDetailTab === "contracts")
  );
}

/** Portraits tab needs league-wide heat pools; defer full ratings until this tab is active. */
export function resolveShouldBuildTeamsPortraitsTab(
  activeView: string,
  selectedTeamDetailTab: "roster" | "contracts" | "portraits",
): boolean {
  return shouldBuildTeamsView(activeView) && selectedTeamDetailTab === "portraits";
}

export function resolveShouldBuildTeamsRosterDerivations(input: {
  activeView: string;
  teamsHydrationPhase: "shell" | "full";
}): boolean {
  return shouldBuildTeamsView(input.activeView) && input.teamsHydrationPhase === "full";
}

function roundViewNumber(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function buildSharedRankMap(values: Array<{ teamId: string; value: number }>) {
  const sortedValues = [...values].sort((left, right) => {
    if (right.value !== left.value) {
      return right.value - left.value;
    }
    return left.teamId.localeCompare(right.teamId, "de");
  });
  const rankMap = new Map<string, number>();
  let previousValue: number | null = null;
  let previousRank = 0;

  sortedValues.forEach((entry, index) => {
    if (previousValue != null && Math.abs(previousValue - entry.value) < 0.0001) {
      rankMap.set(entry.teamId, previousRank);
      return;
    }

    const nextRank = index + 1;
    previousValue = entry.value;
    previousRank = nextRank;
    rankMap.set(entry.teamId, nextRank);
  });

  return rankMap;
}

function buildNullableSharedRankMap(values: Array<{ teamId: string; value: number | null | undefined }>) {
  const numericValues = values.filter(
    (entry): entry is { teamId: string; value: number } =>
      typeof entry.value === "number" && Number.isFinite(entry.value),
  );

  if (numericValues.length === 0) {
    return new Map<string, number | null>(values.map((entry) => [entry.teamId, null]));
  }

  const rankedValues = buildSharedRankMap(numericValues);
  return new Map<string, number | null>(
    values.map((entry) => [
      entry.teamId,
      typeof entry.value === "number" && Number.isFinite(entry.value)
        ? (rankedValues.get(entry.teamId) ?? null)
        : null,
    ]),
  );
}

function buildSeasonStandAreaRanksByTeamId(
  seasonStandRows: TeamManagementSnapshotRow[],
): Map<string, TeamsAreaRank> {
  const powRankMap = buildSharedRankMap(
    seasonStandRows.map((row) => ({ teamId: row.teamId, value: row.ppsPow ?? 0 })),
  );
  const speRankMap = buildSharedRankMap(
    seasonStandRows.map((row) => ({ teamId: row.teamId, value: row.ppsSpe ?? 0 })),
  );
  const menRankMap = buildSharedRankMap(
    seasonStandRows.map((row) => ({ teamId: row.teamId, value: row.ppsMen ?? 0 })),
  );
  const socRankMap = buildSharedRankMap(
    seasonStandRows.map((row) => ({ teamId: row.teamId, value: row.ppsSoc ?? 0 })),
  );

  return new Map(
    seasonStandRows.map((row) => {
      const hasActiveRoster = row.rosterCount > 0;
      return [
        row.teamId,
        {
          pow: hasActiveRoster && (row.ppsPow ?? 0) > 0 ? (powRankMap.get(row.teamId) ?? null) : null,
          spe: hasActiveRoster && (row.ppsSpe ?? 0) > 0 ? (speRankMap.get(row.teamId) ?? null) : null,
          men: hasActiveRoster && (row.ppsMen ?? 0) > 0 ? (menRankMap.get(row.teamId) ?? null) : null,
          soc: hasActiveRoster && (row.ppsSoc ?? 0) > 0 ? (socRankMap.get(row.teamId) ?? null) : null,
        },
      ] as const;
    }),
  );
}

export function resolveCurrentAreaRanksByTeamId(input: {
  activeView: string;
  shouldBuildTeamsView: boolean;
  shouldBuildDisciplineRanks: boolean;
  disciplineRankRows: DisciplineRankRowInput[];
  seasonStandRows: TeamManagementSnapshotRow[];
}): Map<string, TeamsAreaRank> {
  if (input.shouldBuildDisciplineRanks && input.disciplineRankRows.length > 0) {
    return new Map(
      input.disciplineRankRows.map((row) => [
        row.team.teamId,
        {
          pow: row.scorePack.pow > 0 ? row.powRank || null : null,
          spe: row.scorePack.spe > 0 ? row.speRank || null : null,
          men: row.scorePack.men > 0 ? row.menRank || null : null,
          soc: row.scorePack.soc > 0 ? row.socRank || null : null,
        },
      ]),
    );
  }

  if (!input.shouldBuildTeamsView && input.activeView !== "teamProfile") {
    return EMPTY_AREA_RANK_MAP;
  }

  return buildSeasonStandAreaRanksByTeamId(input.seasonStandRows);
}

export function buildTeamsViewRows(input: {
  seasonStandRows: TeamManagementSnapshotRow[];
  currentAreaRanksByTeamId: Map<string, TeamsAreaRank>;
}): TeamsViewRow[] {
  const seasonStandRowByTeamId = new Map(input.seasonStandRows.map((row) => [row.teamId, row] as const));
  return [...input.seasonStandRows]
    .map((row) => {
      const standing = seasonStandRowByTeamId.get(row.team.teamId) ?? null;
      const currentAreaRanks = input.currentAreaRanksByTeamId.get(row.team.teamId) ?? null;
      const avgSalary = row.rosterCount > 0 ? roundViewNumber(row.salaryTotal / row.rosterCount, 2) : null;
      const hasActiveRoster = row.rosterCount > 0;

      return {
        ...row,
        currentPowRank: hasActiveRoster ? (currentAreaRanks?.pow ?? null) : null,
        currentSpeRank: hasActiveRoster ? (currentAreaRanks?.spe ?? null) : null,
        currentMenRank: hasActiveRoster ? (currentAreaRanks?.men ?? null) : null,
        currentSocRank: hasActiveRoster ? (currentAreaRanks?.soc ?? null) : null,
        historicalPow: row.historicalPow,
        historicalSpe: row.historicalSpe,
        historicalMen: row.historicalMen,
        historicalSoc: row.historicalSoc,
        historicalPointsTotal: row.historicalPointsTotal,
        historicalAvgPoints: row.historicalAvgPoints,
        historicalPointsBySeason: row.historicalPointsBySeason,
        historicalEconomyBySeason: row.historicalEconomyBySeason,
        historicalHasData: row.historicalHasData,
        historicalSeasonsPlayed: row.historicalSeasonsPlayed,
        historicalBestRank: row.historicalBestRank,
        historicalLastSeasonRank: row.historicalLastSeasonRank,
        historicalLastSeasonPoints: row.historicalLastSeasonPoints,
        overallRank: standing?.rank ?? null,
        cash: row.cash ?? standing?.cash ?? null,
        guv: standing?.guv ?? null,
        sponsorTotal: standing?.sponsorTotal ?? null,
        avgMarketValue: row.avgMarketValue,
        avgSalary,
        goldCount: row.historicalGoldCount,
        silverCount: row.historicalSilverCount,
        bronzeCount: row.historicalBronzeCount,
        avgRank: row.historicalAvgRank,
        avgPoints: row.historicalAvgPoints,
        top5: row.historicalTop5Count,
        top10: row.historicalTop10Count,
      };
    })
    .sort((left, right) => {
      const leftRank = left.overallRank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.overallRank ?? Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return (left.avgRank ?? Number.POSITIVE_INFINITY) - (right.avgRank ?? Number.POSITIVE_INFINITY);
    });
}

export function buildSortedTeamsViewRows(
  teamsViewRows: TeamsViewRow[],
  teamsViewSort: FoundationTableSortState | undefined,
): TeamsViewRow[] {
  return sortFoundationTableRows(teamsViewRows, teamsViewSort, {
    team: (row) => row.team.name,
    overallRank: (row) => row.overallRank ?? Number.POSITIVE_INFINITY,
    cash: (row) => row.cash ?? Number.NEGATIVE_INFINITY,
    guv: (row) => row.guv ?? Number.NEGATIVE_INFINITY,
    roster: (row) => row.rosterCount,
    mw: (row) => row.marketValueTotal ?? Number.NEGATIVE_INFINITY,
    salary: (row) => row.salaryTotal,
    sponsor: (row) => row.sponsorTotal ?? Number.NEGATIVE_INFINITY,
    pow: (row) => -(row.currentPowRank ?? Number.POSITIVE_INFINITY),
    spe: (row) => -(row.currentSpeRank ?? Number.POSITIVE_INFINITY),
    men: (row) => -(row.currentMenRank ?? Number.POSITIVE_INFINITY),
    soc: (row) => -(row.currentSocRank ?? Number.POSITIVE_INFINITY),
    histPoints: (row) => row.historicalPointsTotal ?? Number.NEGATIVE_INFINITY,
    avgPoints: (row) => row.avgPoints ?? Number.NEGATIVE_INFINITY,
    gold: (row) => row.goldCount,
    silver: (row) => row.silverCount,
    bronze: (row) => row.bronzeCount,
    top5: (row) => row.top5,
    top10: (row) => row.top10,
    avgRank: (row) => row.avgRank ?? Number.POSITIVE_INFINITY,
    seasonPoints: (row) => row.historicalPointsBySeason.length,
  });
}

export function buildTeamHistorySeasonPointColumns(teamsViewRows: TeamsViewRow[]): TeamHistorySeasonPointColumn[] {
  const seasonMap = new Map<string, TeamHistorySeasonPointColumn>();
  for (const row of teamsViewRows) {
    for (const entry of row.historicalPointsBySeason ?? []) {
      seasonMap.set(entry.seasonId, {
        seasonId: entry.seasonId,
        seasonName: entry.seasonName,
      });
    }
  }

  return Array.from(seasonMap.values()).sort((left, right) =>
    left.seasonId.localeCompare(right.seasonId, "de", { numeric: true }),
  );
}

export function buildTeamHistoryPointRankMaps(
  teamsViewRows: TeamsViewRow[],
  teamHistorySeasonPointColumns: TeamHistorySeasonPointColumn[],
): TeamHistoryPointRankMaps {
  const total = buildNullableSharedRankMap(
    teamsViewRows.map((row) => ({
      teamId: row.team.teamId,
      value: row.historicalPointsTotal,
    })),
  );
  const average = buildNullableSharedRankMap(
    teamsViewRows.map((row) => ({
      teamId: row.team.teamId,
      value: row.historicalAvgPoints,
    })),
  );
  const bySeason = new Map(
    teamHistorySeasonPointColumns.map((seasonColumn) => [
      seasonColumn.seasonId,
      buildNullableSharedRankMap(
        teamsViewRows.map((row) => ({
          teamId: row.team.teamId,
          value:
            row.historicalPointsBySeason.find((entry) => entry.seasonId === seasonColumn.seasonId)?.points ?? null,
        })),
      ),
    ]),
  );

  return { total, average, bySeason };
}

export function buildTeamsViewSummary(input: {
  selectedTeam: Team | null;
  teamsViewRows: TeamsViewRow[];
  currentAreaRanksByTeamId: Map<string, TeamsAreaRank>;
}): TeamsViewSummary | null {
  if (!input.selectedTeam) {
    return null;
  }

  const row = input.teamsViewRows.find((entry) => entry.team.teamId === input.selectedTeam?.teamId);
  if (!row) {
    return null;
  }

  const currentAreaRanks = input.currentAreaRanksByTeamId.get(input.selectedTeam.teamId) ?? null;
  return {
    ...row,
    powRank: row.rosterCount > 0 ? (currentAreaRanks?.pow ?? null) : null,
    speRank: row.rosterCount > 0 ? (currentAreaRanks?.spe ?? null) : null,
    menRank: row.rosterCount > 0 ? (currentAreaRanks?.men ?? null) : null,
    socRank: row.rosterCount > 0 ? (currentAreaRanks?.soc ?? null) : null,
  };
}

export function buildSelectedHqAxisSummary(teamsViewSummary: TeamsViewSummary | null): SelectedHqAxisSummary | null {
  if (!teamsViewSummary) {
    return null;
  }

  const axes = [
    { label: "POW" as const, rank: teamsViewSummary.powRank },
    { label: "SPE" as const, rank: teamsViewSummary.speRank },
    { label: "MEN" as const, rank: teamsViewSummary.menRank },
    { label: "SOC" as const, rank: teamsViewSummary.socRank },
  ]
    .filter((entry): entry is { label: "POW" | "SPE" | "MEN" | "SOC"; rank: number } => entry.rank != null)
    .sort((left, right) => left.rank - right.rank);
  if (axes.length === 0) {
    return null;
  }

  return {
    strongest: axes[0] ?? null,
    weakest: axes[axes.length - 1] ?? null,
    weakestTwo: [...axes].sort((left, right) => right.rank - left.rank).slice(0, 2),
  };
}

export {
  EMPTY_AREA_RANK_MAP,
  EMPTY_TEAM_HISTORY_COLUMNS,
  EMPTY_TEAM_HISTORY_POINT_RANK_MAPS,
  EMPTY_TEAMS_VIEW_ROWS,
};
