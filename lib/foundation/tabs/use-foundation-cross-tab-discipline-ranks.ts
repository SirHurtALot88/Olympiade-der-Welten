import { useMemo } from "react";

import type { Discipline, GameState, Player, Team } from "@/lib/data/olyDataTypes";
import type { SortState } from "@/lib/foundation/foundation-table-ui-types";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import { sortTableRows as sortRows } from "@/components/foundation/FoundationTableUi";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import {
  shouldBuildDisciplineConfigDerivations as resolveShouldBuildDisciplineConfigDerivations,
  shouldBuildDisciplineRanks as resolveShouldBuildDisciplineRanks,
} from "@/lib/foundation/tabs/season-v2-derivations";
import { buildSharedRankMap, roundViewNumber } from "@/lib/foundation/tabs/season-stand-render-helpers";

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
  tableSorts: {
    disciplineRanks: SortState;
    disciplineConfig: SortState;
  };
}) {
  const shouldBuildDisciplineRanks = shouldBuildFoundationDisciplineRanks({
    activeView: input.activeView,
    shouldBuildTeamsHeavyComparison: input.shouldBuildTeamsHeavyComparison,
  });
  const shouldBuildDisciplineConfigDerivations = shouldBuildFoundationDisciplineConfigDerivations({
    activeView: input.activeView,
    shouldLoadSeasonOverviewFeed: input.shouldLoadSeasonOverviewFeed,
  });

  const disciplineRankRows = useMemo(() => {
    if (!shouldBuildDisciplineRanks) {
      return [] as FoundationDisciplineRankRow[];
    }

    const rosterByTeamId = new Map<string, Player[]>();
    const playerById = new Map(input.gameState.players.map((player) => [player.id, player] as const));

    for (const team of input.gameState.teams) {
      rosterByTeamId.set(team.teamId, []);
    }

    for (const rosterEntry of input.gameState.rosters) {
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

    const disciplineScoresByTeam = new Map<
      string,
      {
        total: number;
        pow: number;
        spe: number;
        men: number;
        soc: number;
        disciplines: Record<string, number>;
      }
    >();

    for (const team of input.gameState.teams) {
      const disciplineScores = Object.fromEntries(
        input.orderedDisciplines.map((discipline) => [
          discipline.id,
          computeTopSixDisciplineSum(team.teamId, discipline.id),
        ]),
      );
      const pow = roundViewNumber(
        input.orderedDisciplines
          .filter((discipline) => discipline.category === "power")
          .reduce((sum, discipline) => sum + (disciplineScores[discipline.id] ?? 0), 0),
        2,
      );
      const spe = roundViewNumber(
        input.orderedDisciplines
          .filter((discipline) => discipline.category === "speed")
          .reduce((sum, discipline) => sum + (disciplineScores[discipline.id] ?? 0), 0),
        2,
      );
      const men = roundViewNumber(
        input.orderedDisciplines
          .filter((discipline) => discipline.category === "mental")
          .reduce((sum, discipline) => sum + (disciplineScores[discipline.id] ?? 0), 0),
        2,
      );
      const soc = roundViewNumber(
        input.orderedDisciplines
          .filter((discipline) => discipline.category === "social")
          .reduce((sum, discipline) => sum + (disciplineScores[discipline.id] ?? 0), 0),
        2,
      );
      const total = roundViewNumber(
        input.orderedDisciplines.reduce((sum, discipline) => sum + (disciplineScores[discipline.id] ?? 0), 0),
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
      input.gameState.teams.map((team) => ({
        teamId: team.teamId,
        value: disciplineScoresByTeam.get(team.teamId)?.total ?? 0,
      })),
    );
    const powRankMap = buildSharedRankMap(
      input.gameState.teams.map((team) => ({
        teamId: team.teamId,
        value: disciplineScoresByTeam.get(team.teamId)?.pow ?? 0,
      })),
    );
    const speRankMap = buildSharedRankMap(
      input.gameState.teams.map((team) => ({
        teamId: team.teamId,
        value: disciplineScoresByTeam.get(team.teamId)?.spe ?? 0,
      })),
    );
    const menRankMap = buildSharedRankMap(
      input.gameState.teams.map((team) => ({
        teamId: team.teamId,
        value: disciplineScoresByTeam.get(team.teamId)?.men ?? 0,
      })),
    );
    const socRankMap = buildSharedRankMap(
      input.gameState.teams.map((team) => ({
        teamId: team.teamId,
        value: disciplineScoresByTeam.get(team.teamId)?.soc ?? 0,
      })),
    );

    const disciplineRankMaps = new Map(
      input.orderedDisciplines.map((discipline) => [
        discipline.id,
        buildSharedRankMap(
          input.gameState.teams.map((team) => ({
            teamId: team.teamId,
            value: disciplineScoresByTeam.get(team.teamId)?.disciplines[discipline.id] ?? 0,
          })),
        ),
      ]),
    );

    return [...input.gameState.teams]
      .map((team) => {
        const scorePack = disciplineScoresByTeam.get(team.teamId) ?? {
          total: 0,
          pow: 0,
          spe: 0,
          men: 0,
          soc: 0,
          disciplines: Object.fromEntries(
            input.orderedDisciplines.map((discipline) => [discipline.id, 0] as const),
          ),
        };
        const disciplineRanks = Object.fromEntries(
          input.orderedDisciplines.map((discipline) => [
            discipline.id,
            disciplineRankMaps.get(discipline.id)?.get(team.teamId) ?? 0,
          ]),
        );

        return {
          team,
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
        return left.team.name.localeCompare(right.team.name, "de");
      });
  }, [input.gameState, input.orderedDisciplines, shouldBuildDisciplineRanks]);

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
  };
}
