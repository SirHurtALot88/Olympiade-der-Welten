import { useMemo } from "react";

import type { Discipline, GameState, Team } from "@/lib/data/olyDataTypes";
import type { SortState } from "@/lib/foundation/foundation-table-ui-types";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import { sortTableRows as sortRows } from "@/components/foundation/FoundationTableUi";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import {
  shouldBuildDisciplineConfigDerivations as resolveShouldBuildDisciplineConfigDerivations,
  shouldBuildDisciplineRanks as resolveShouldBuildDisciplineRanks,
} from "@/lib/foundation/tabs/season-v2-derivations";
import {
  buildPreviousTeamDisciplineRankLookup,
  buildTeamDisciplineRankDeltaPack,
  buildTeamDisciplineRankRowsFromGameState,
  buildTeamDisciplineRankRowsFromSnapshotRecords,
  type TeamDisciplineRankDeltaPack,
} from "@/lib/foundation/team-discipline-rank-engine";

export type FoundationDisciplineRankRow = {
  team: Team;
  totalRank: number;
  powRank: number;
  speRank: number;
  menRank: number;
  socRank: number;
  disciplineRanks: Record<string, number>;
  scorePack: {
    total: number;
    pow: number;
    spe: number;
    men: number;
    soc: number;
    disciplines: Record<string, number>;
  };
  rankDeltas: TeamDisciplineRankDeltaPack;
};

export type FoundationDisciplineLeaderEntry = {
  id: string;
  label: string;
  tone: string;
  scoreKey: "total" | "pow" | "spe" | "men" | "soc";
  row: FoundationDisciplineRankRow | null;
};

export type FoundationDisciplineConfigRow = Discipline & {
  originalOrder: number;
  displayOrder: number;
  playerCount: number;
  mutator1: string;
  mutator2: string;
};

type SeasonSnapshotInput = NonNullable<GameState["seasonState"]["seasonSnapshots"]>[number];

export function shouldBuildFoundationDisciplineRanks(input: {
  activeView: FoundationViewId;
  shouldBuildTeamsHeavyComparison: boolean;
}): boolean {
  return resolveShouldBuildDisciplineRanks(input);
}

export function shouldBuildFoundationDisciplineConfigDerivations(input: {
  activeView: FoundationViewId;
  shouldLoadSeasonOverviewFeed: boolean;
}): boolean {
  return resolveShouldBuildDisciplineConfigDerivations(input);
}

export function useFoundationCrossTabDisciplineRanks(input: {
  activeView: FoundationViewId;
  shouldBuildTeamsHeavyComparison: boolean;
  shouldLoadSeasonOverviewFeed: boolean;
  isFoundationBootstrapState: boolean;
  gameState: GameState;
  activeSaveId: string;
  orderedDisciplines: Discipline[];
  disciplineCategoryFilter: string;
  ranksSeasonId: string;
  seasonHistorySnapshots: SeasonSnapshotInput[];
  tableSorts: Record<string, SortState>;
}) {
  const shouldBuildDisciplineRanks = shouldBuildFoundationDisciplineRanks({
    activeView: input.activeView,
    shouldBuildTeamsHeavyComparison: input.shouldBuildTeamsHeavyComparison,
  });
  const shouldBuildDisciplineConfigDerivations = shouldBuildFoundationDisciplineConfigDerivations({
    activeView: input.activeView,
    shouldLoadSeasonOverviewFeed: input.shouldLoadSeasonOverviewFeed,
  });

  const teamsById = useMemo(
    () => new Map(input.gameState.teams.map((team) => [team.teamId, team] as const)),
    [input.gameState.teams],
  );

  const selectedRanksSeasonSnapshot = useMemo(
    () =>
      input.seasonHistorySnapshots.find((snapshot) => snapshot.seasonId === input.ranksSeasonId) ?? null,
    [input.ranksSeasonId, input.seasonHistorySnapshots],
  );

  const isViewingArchivedRanksSeason =
    input.ranksSeasonId !== input.gameState.season.id && selectedRanksSeasonSnapshot != null;

  const ranksArchiveMissing =
    isViewingArchivedRanksSeason && !selectedRanksSeasonSnapshot?.teamDisciplineRankSnapshots?.length;

  const previousRankLookup = useMemo(
    () => buildPreviousTeamDisciplineRankLookup(input.seasonHistorySnapshots, input.ranksSeasonId),
    [input.ranksSeasonId, input.seasonHistorySnapshots],
  );

  const disciplineRankRows = useMemo(() => {
    if (!shouldBuildDisciplineRanks) {
      return [] as FoundationDisciplineRankRow[];
    }

    const useArchivedRanks =
      isViewingArchivedRanksSeason && Boolean(selectedRanksSeasonSnapshot?.teamDisciplineRankSnapshots?.length);

    const coreRows = useArchivedRanks
      ? buildTeamDisciplineRankRowsFromSnapshotRecords(
          selectedRanksSeasonSnapshot!.teamDisciplineRankSnapshots!,
          teamsById,
          input.orderedDisciplines,
        )
      : buildTeamDisciplineRankRowsFromGameState(input.gameState, input.orderedDisciplines);

    return coreRows
      .map((rowCore) => {
        const team =
          teamsById.get(rowCore.teamId) ??
          ({
            teamId: rowCore.teamId,
            name: rowCore.teamName,
            shortCode: rowCore.teamCode ?? rowCore.teamId.slice(0, 3).toUpperCase(),
          } as Team);

        return {
          team,
          totalRank: rowCore.totalRank,
          powRank: rowCore.powRank,
          speRank: rowCore.speRank,
          menRank: rowCore.menRank,
          socRank: rowCore.socRank,
          disciplineRanks: rowCore.disciplineRanks,
          scorePack: rowCore.scorePack,
          rankDeltas: buildTeamDisciplineRankDeltaPack(rowCore, previousRankLookup.get(rowCore.teamId)),
        };
      })
      .sort((left, right) => {
        if (left.totalRank !== right.totalRank) {
          return left.totalRank - right.totalRank;
        }
        return left.team.name.localeCompare(right.team.name, "de");
      });
  }, [
    input.gameState,
    input.orderedDisciplines,
    input.ranksSeasonId,
    isViewingArchivedRanksSeason,
    previousRankLookup,
    selectedRanksSeasonSnapshot,
    shouldBuildDisciplineRanks,
    teamsById,
  ]);

  const seasonDisciplineScheduleRows = useMemo(
    () =>
      getSeasonDisciplineSchedule(input.gameState, {
        saveId: input.activeSaveId || "normalized-local-save",
      }),
    [input.activeSaveId, input.gameState],
  );

  const seasonBriefingScheduleReady = useMemo(
    () =>
      !input.isFoundationBootstrapState &&
      input.gameState.disciplines.length > 0 &&
      seasonDisciplineScheduleRows.some(
        (entry) => Boolean(entry.discipline1?.disciplineId || entry.discipline2?.disciplineId),
      ),
    [input.gameState.disciplines.length, input.isFoundationBootstrapState, seasonDisciplineScheduleRows],
  );

  const seasonDisciplineConfigMap = useMemo(() => {
    if (!shouldBuildDisciplineConfigDerivations) {
      return new Map<string, { displayOrder: number; playerCount: number | null }>();
    }
    const slotMeta = new Map<string, { displayOrder: number; playerCount: number | null }>();
    seasonDisciplineScheduleRows.forEach((entry, matchdayIndex) => {
      [entry.discipline1, entry.discipline2].forEach((slot, slotIndex) => {
        if (!slot?.disciplineId) {
          return;
        }
        slotMeta.set(slot.disciplineId, {
          displayOrder: matchdayIndex * 2 + slotIndex + 1,
          playerCount: slot.playerCount ?? null,
        });
      });
    });
    return slotMeta;
  }, [seasonDisciplineScheduleRows, shouldBuildDisciplineConfigDerivations]);

  const disciplineConfigRows = useMemo(() => {
    if (!shouldBuildDisciplineConfigDerivations) {
      return [] as FoundationDisciplineConfigRow[];
    }
    return [...input.gameState.disciplines].map((discipline) => {
      const seasonalMeta = seasonDisciplineConfigMap.get(discipline.id);
      return {
        ...discipline,
        originalOrder: discipline.originalOrder ?? 0,
        displayOrder: seasonalMeta?.displayOrder ?? discipline.displayOrder ?? 0,
        playerCount: seasonalMeta?.playerCount ?? discipline.playerCount ?? 0,
        mutator1: discipline.mutator1 ?? "",
        mutator2: discipline.mutator2 ?? "",
      };
    });
  }, [input.gameState.disciplines, seasonDisciplineConfigMap, shouldBuildDisciplineConfigDerivations]);

  const currentMatchdayDisciplineSchedule = useMemo(
    () =>
      seasonDisciplineScheduleRows.find(
        (entry) => entry.matchdayId === input.gameState.matchdayState.matchdayId,
      ) ?? null,
    [input.gameState.matchdayState.matchdayId, seasonDisciplineScheduleRows],
  );

  const sortedDisciplineRankRows = useMemo(
    () =>
      sortRows(disciplineRankRows, input.tableSorts.disciplineRanks, {
        team: (row) => row.team.name,
        totalRank: (row) => row.totalRank,
        powRank: (row) => row.powRank,
        speRank: (row) => row.speRank,
        menRank: (row) => row.menRank,
        socRank: (row) => row.socRank,
        ...Object.fromEntries(
          input.orderedDisciplines.map((discipline) => [
            discipline.id,
            (row: FoundationDisciplineRankRow) => row.disciplineRanks[discipline.id] ?? 0,
          ]),
        ),
      }),
    [disciplineRankRows, input.orderedDisciplines, input.tableSorts.disciplineRanks],
  );

  const disciplineLeaderEntries = useMemo(() => {
    const findLeader = (
      key: "totalRank" | "powRank" | "speRank" | "menRank" | "socRank",
      scoreKey: "total" | "pow" | "spe" | "men" | "soc",
    ) =>
      disciplineRankRows
        .filter((row) => row.scorePack[scoreKey] > 0)
        .sort((left, right) => {
          const rankDelta = left[key] - right[key];
          if (rankDelta !== 0) {
            return rankDelta;
          }
          return right.scorePack[scoreKey] - left.scorePack[scoreKey];
        })[0] ?? null;

    const entries: FoundationDisciplineLeaderEntry[] = [
      { id: "total", label: "Gesamt", tone: "total", scoreKey: "total", row: findLeader("totalRank", "total") },
      { id: "pow", label: "POW", tone: "pow", scoreKey: "pow", row: findLeader("powRank", "pow") },
      { id: "spe", label: "SPE", tone: "spe", scoreKey: "spe", row: findLeader("speRank", "spe") },
      { id: "men", label: "MEN", tone: "men", scoreKey: "men", row: findLeader("menRank", "men") },
      { id: "soc", label: "SOC", tone: "soc", scoreKey: "soc", row: findLeader("socRank", "soc") },
    ];
    return entries;
  }, [disciplineRankRows]);

  const sortedDisciplineConfigRows = useMemo(
    () =>
      sortRows(disciplineConfigRows, input.tableSorts.disciplineConfig, {
        originalOrder: (row) => row.originalOrder,
        displayOrder: (row) => row.displayOrder,
        name: (row) => row.name,
        playerCount: (row) => row.playerCount,
        mutator1: (row) => row.mutator1,
        mutator2: (row) => row.mutator2,
      }),
    [disciplineConfigRows, input.tableSorts.disciplineConfig],
  );

  const visibleDisciplineConfigRows = useMemo(
    () =>
      input.disciplineCategoryFilter === "all"
        ? sortedDisciplineConfigRows
        : sortedDisciplineConfigRows.filter((discipline) => discipline.category === input.disciplineCategoryFilter),
    [input.disciplineCategoryFilter, sortedDisciplineConfigRows],
  );

  return {
    shouldBuildDisciplineRanks,
    shouldBuildDisciplineConfigDerivations,
    disciplineRankRows,
    sortedDisciplineRankRows,
    disciplineLeaderEntries,
    seasonDisciplineScheduleRows,
    seasonBriefingScheduleReady,
    disciplineConfigRows,
    currentMatchdayDisciplineSchedule,
    sortedDisciplineConfigRows,
    visibleDisciplineConfigRows,
    isViewingArchivedRanksSeason,
    ranksArchiveMissing,
    ranksSeasonId: input.ranksSeasonId,
  };
}
