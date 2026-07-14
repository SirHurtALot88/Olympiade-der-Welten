import { useEffect, useMemo } from "react";

import { sortTableRows as sortRows } from "@/components/foundation/FoundationTableUi";
import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import type { SortState } from "@/lib/foundation/foundation-table-ui-types";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import {
  createEmptyLeaguePlayerHeatPools,
  type LeaguePlayerHeatPools,
} from "@/lib/foundation/player-league-heat";
import {
  buildPlayerLeagueCareerStatsMap,
  type PlayerLeagueCareerStats,
} from "@/lib/foundation/player-league-career-stats";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import type { SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import type { PlayerTableScope } from "@/lib/foundation/tabs/foundation-page-types";
import {
  getPlayerDisplayMarketValue,
  getRosterEntrySalarySortValue,
} from "@/lib/foundation/tabs/season-stand-render-helpers";
import { getTransfermarktBracket } from "@/lib/market/transfermarkt-fit";

export type FoundationPlayerScopeRow = {
  player: Player;
  roster: RosterEntry | null;
  team: Team | null;
  seasonPerformance: {
    appearances: number;
    totalPoints: number | null;
    bestDisciplineLabel: string | null;
  } | null;
  playerOvr: number | null;
  playerMvs: number | null;
  playerPps: number | null;
  seasonPoints: number | null;
  appearances: number | null;
  bestDiscipline: string | null;
  careerLeagueStats: PlayerLeagueCareerStats | null;
  isActive: boolean;
  isFreeAgent: boolean;
  transferStatus: string;
};

export function shouldBuildFoundationPlayerDirectory(activeView: FoundationViewId): boolean {
  return activeView === "players";
}

/**
 * Sortier-Schlüssel-Präfix für "nach Disziplin-Wertung sortieren" (Neuer Look,
 * Achsen-Spalte). Dynamischer Schlüssel statt eines festen Katalog-Eintrags,
 * weil die Disziplinliste (`gameState.disciplines`) pro Save variiert — siehe
 * `buildDisciplineSortKey`/`getDisciplineIdFromSortKey` und deren Verwendung
 * in BEIDEN Accessor-Maps unten (`sortedPlayersTableRows` + der `useEffect`).
 */
const DISCIPLINE_SORT_KEY_PREFIX = "discipline:";

export function buildDisciplineSortKey(disciplineId: string): string {
  return `${DISCIPLINE_SORT_KEY_PREFIX}${disciplineId}`;
}

export function getDisciplineIdFromSortKey(sortKey: string | null | undefined): string | null {
  if (!sortKey || !sortKey.startsWith(DISCIPLINE_SORT_KEY_PREFIX)) {
    return null;
  }
  return sortKey.slice(DISCIPLINE_SORT_KEY_PREFIX.length);
}

export function shouldBuildFoundationLeagueHeatPools(input: {
  shouldBuildPlayerDirectory: boolean;
  shouldBuildMarketView: boolean;
  shouldBuildTeamHistory: boolean;
  activeView: FoundationViewId;
  showExtendedTeamPanels: boolean;
  selectedTeamDetailTab: string;
  homeV2Tab?: string;
  homeV2OverviewHeavyReady?: boolean;
}): boolean {
  if (input.shouldBuildPlayerDirectory || input.shouldBuildMarketView || input.shouldBuildTeamHistory) {
    return true;
  }
  if (input.activeView === "homeV2") {
    if ((input.homeV2Tab ?? "overview") !== "overview") {
      return false;
    }
    return input.homeV2OverviewHeavyReady ?? true;
  }
  if (
    input.activeView === "season" ||
    input.activeView === "seasonPreview" ||
    input.activeView === "ranks"
  ) {
    return true;
  }
  return input.activeView === "teams" && (input.showExtendedTeamPanels || input.selectedTeamDetailTab === "portraits");
}

export function useFoundationCrossTabPlayerDirectory(input: {
  activeView: FoundationViewId;
  shouldBuildPlayerDirectory: boolean;
  shouldBuildMarketView: boolean;
  shouldBuildTeamHistory: boolean;
  showExtendedTeamPanels: boolean;
  selectedTeamDetailTab: string;
  homeV2Tab?: string;
  homeV2OverviewHeavyReady?: boolean;
  gameState: GameState;
  playerRatingsById: Map<string, PlayerRatingContractRow>;
  playerDirectorySlice: {
    loading: boolean;
    payload: unknown;
    error: string | null;
    performanceByPlayerId: Record<
      string,
      {
        appearances?: number;
        totalPoints?: number | null;
        bestDisciplineLabel?: string | null;
      }
    >;
    careerStatsByPlayerId: Record<string, PlayerLeagueCareerStats>;
  };
  playerScope: PlayerTableScope;
  playerSeasonPerformanceMap: Map<string, PlayerSeasonPerformanceSummary>;
  seasonPointsLedger: SeasonPointsLedger | null | undefined;
  deferredPlayerTeamFilter: string;
  deferredPlayerClassFilter: string;
  deferredPlayerBracketFilter: string;
  tableSorts: Record<string, SortState>;
  playerDirectoryOrderedIds: string[] | null | undefined;
  sortPlayerDirectoryRows: (
    rows: Array<{ id: string; sortValues: Record<string, string | number> }>,
    key: string,
    direction: "asc" | "desc",
  ) => void;
}) {
  const shouldBuildLeagueHeatPools = shouldBuildFoundationLeagueHeatPools({
    shouldBuildPlayerDirectory: input.shouldBuildPlayerDirectory,
    shouldBuildMarketView: input.shouldBuildMarketView,
    shouldBuildTeamHistory: input.shouldBuildTeamHistory,
    activeView: input.activeView,
    showExtendedTeamPanels: input.showExtendedTeamPanels,
    selectedTeamDetailTab: input.selectedTeamDetailTab,
    homeV2Tab: input.homeV2Tab,
    homeV2OverviewHeavyReady: input.homeV2OverviewHeavyReady,
  });

  const playerLeagueCareerStatsMap = useMemo(
    () => {
      if (input.shouldBuildPlayerDirectory && input.playerDirectorySlice.loading && !input.playerDirectorySlice.payload) {
        return new Map();
      }
      if (input.shouldBuildPlayerDirectory && input.playerDirectorySlice.payload && !input.playerDirectorySlice.error) {
        return new Map(Object.entries(input.playerDirectorySlice.careerStatsByPlayerId));
      }
      return input.shouldBuildPlayerDirectory
        ? buildPlayerLeagueCareerStatsMap(input.gameState, {
            currentSeasonPerformanceByPlayerId: input.playerSeasonPerformanceMap,
            currentSeasonLedger: input.seasonPointsLedger,
          })
        : new Map();
    },
    [
      input.gameState,
      input.playerDirectorySlice.careerStatsByPlayerId,
      input.playerDirectorySlice.error,
      input.playerDirectorySlice.loading,
      input.playerDirectorySlice.payload,
      input.playerSeasonPerformanceMap,
      input.seasonPointsLedger,
      input.shouldBuildPlayerDirectory,
    ],
  );

  const leaguePlayerHeatPools = useMemo((): LeaguePlayerHeatPools => {
    const disciplineIds = input.gameState.disciplines.map((discipline) => discipline.id);
    const pools = createEmptyLeaguePlayerHeatPools(disciplineIds);

    if (!shouldBuildLeagueHeatPools) {
      return pools;
    }

    // Rang/Heat nur relativ zu AKTIVEN Spielern (mit Roster-Eintrag) berechnen —
    // nicht gegen die gesamte Spielerdatenbank (Free Agents + generierte Reserve),
    // sonst entstehen unsinnige Ränge wie "#1.988".
    const activePlayerIds = new Set(input.gameState.rosters.map((roster) => roster.playerId));
    for (const player of input.gameState.players) {
      if (!activePlayerIds.has(player.id)) {
        continue;
      }
      const playerRating = input.playerRatingsById.get(player.id) ?? null;
      if (playerRating?.ovrNormalized != null) {
        pools.ovr.push(playerRating.ovrNormalized);
      }
      if (playerRating?.mvs != null) {
        pools.mvs.push(playerRating.mvs);
      }
      if (playerRating?.ppsSeason != null) {
        pools.pps.push(playerRating.ppsSeason);
      }
      if (player.coreStats.pow != null) {
        pools.pow.push(player.coreStats.pow);
      }
      if (player.coreStats.spe != null) {
        pools.spe.push(player.coreStats.spe);
      }
      if (player.coreStats.men != null) {
        pools.men.push(player.coreStats.men);
      }
      if (player.coreStats.soc != null) {
        pools.soc.push(player.coreStats.soc);
      }
      for (const discipline of input.gameState.disciplines) {
        const value = player.disciplineRatings[discipline.id];
        if (value != null && Number.isFinite(value)) {
          pools.disciplines[discipline.id]?.push(value);
        }
      }
    }

    return pools;
  }, [
    input.gameState.disciplines,
    input.gameState.players,
    input.gameState.rosters,
    input.playerRatingsById,
    shouldBuildLeagueHeatPools,
  ]);

  const playerScopeRows = useMemo((): FoundationPlayerScopeRow[] => {
    if (!input.shouldBuildPlayerDirectory) {
      return [];
    }

    const teamById = new Map(input.gameState.teams.map((team) => [team.teamId, team] as const));
    const rosterByPlayerId = new Map(input.gameState.rosters.map((roster) => [roster.playerId, roster] as const));

    return input.gameState.players
      .map((player) => {
        const roster = rosterByPlayerId.get(player.id) ?? null;
        const team = roster ? teamById.get(roster.teamId) ?? null : null;
        const directoryPerformance = input.playerDirectorySlice.performanceByPlayerId[player.id];
        const seasonPerformance = directoryPerformance
          ? {
              appearances: directoryPerformance.appearances ?? 0,
              totalPoints: directoryPerformance.totalPoints ?? null,
              bestDisciplineLabel: directoryPerformance.bestDisciplineLabel ?? null,
            }
          : input.playerSeasonPerformanceMap.get(player.id) ?? null;
        const playerRating = input.playerRatingsById.get(player.id) ?? null;
        const isActive = roster != null;
        const isFreeAgent = !isActive;

        return {
          player,
          roster,
          team,
          seasonPerformance,
          playerOvr: playerRating?.ovrNormalized ?? null,
          playerMvs: playerRating?.mvs ?? null,
          playerPps: playerRating?.ppsSeason ?? null,
          seasonPoints: seasonPerformance?.totalPoints ?? null,
          appearances: seasonPerformance?.appearances ?? null,
          bestDiscipline: seasonPerformance?.bestDisciplineLabel ?? null,
          careerLeagueStats: playerLeagueCareerStatsMap.get(player.id) ?? null,
          isActive,
          isFreeAgent,
          transferStatus: isActive ? "Active Player" : "Free Agent",
        };
      })
      .filter((row) => {
        if (input.playerScope === "active") {
          return row.isActive;
        }

        if (input.playerScope === "free_agents") {
          return row.isFreeAgent;
        }

        return true;
      });
  }, [
    input.gameState.players,
    input.gameState.rosters,
    input.gameState.teams,
    input.playerDirectorySlice.performanceByPlayerId,
    input.playerRatingsById,
    input.playerScope,
    input.playerSeasonPerformanceMap,
    input.shouldBuildPlayerDirectory,
    playerLeagueCareerStatsMap,
  ]);

  const playerClassOptions = useMemo(
    () => Array.from(new Set(playerScopeRows.map((row) => row.player.className))).sort((left, right) => left.localeCompare(right)),
    [playerScopeRows],
  );

  const playersTableScopeRows = useMemo(() => {
    return playerScopeRows
      .filter((row) => {
        const matchesTeam = input.deferredPlayerTeamFilter === "ALL" || row.team?.teamId === input.deferredPlayerTeamFilter;
        const matchesClass = input.deferredPlayerClassFilter === "ALL" || row.player.className === input.deferredPlayerClassFilter;
        return matchesTeam && matchesClass;
      })
      .sort((left, right) => (right.playerOvr ?? Number.NEGATIVE_INFINITY) - (left.playerOvr ?? Number.NEGATIVE_INFINITY));
  }, [input.deferredPlayerClassFilter, input.deferredPlayerTeamFilter, playerScopeRows]);

  const playersTableRows = useMemo(() => {
    if (input.deferredPlayerBracketFilter === "ALL") {
      return playersTableScopeRows;
    }
    const bracket = Number(input.deferredPlayerBracketFilter);
    return playersTableScopeRows.filter(
      (row) => getTransfermarktBracket(getPlayerDisplayMarketValue(row.player)) === bracket,
    );
  }, [input.deferredPlayerBracketFilter, playersTableScopeRows]);

  const sortedPlayersTableRows = useMemo(
    () => {
      if (!input.shouldBuildPlayerDirectory) {
        return [];
      }
      const sortState = input.tableSorts.playersTable;
      const accessors: Record<string, (row: (typeof playersTableRows)[number]) => string | number> = {
        name: (row) => row.player.name,
        team: (row) => row.team?.name ?? (row.isFreeAgent ? "Free Agent" : ""),
        class: (row) => row.player.className,
        race: (row) => row.player.race,
        pps: (row) => row.playerPps ?? Number.NEGATIVE_INFINITY,
        ovr: (row) => row.playerOvr ?? Number.NEGATIVE_INFINITY,
        mvs: (row) => row.playerMvs ?? Number.NEGATIVE_INFINITY,
        mw: (row) => getPlayerDisplayMarketValue(row.player) ?? Number.NEGATIVE_INFINITY,
        salary: (row) => (row.roster ? getRosterEntrySalarySortValue(row.roster, row.player) : Number.NEGATIVE_INFINITY),
        contract: (row) => row.roster?.contractLength ?? 0,
        appearances: (row) => row.appearances ?? Number.NEGATIVE_INFINITY,
        bestDiscipline: (row) => row.bestDiscipline ?? "",
        careerLeague: (row) => row.careerLeagueStats?.totalPps ?? Number.NEGATIVE_INFINITY,
        traits: (row) => `${row.player.traitsPositive.join(", ")} ${row.player.traitsNegative.join(", ")}`.trim(),
        pow: (row) => row.player.coreStats.pow ?? Number.NEGATIVE_INFINITY,
        spe: (row) => row.player.coreStats.spe ?? Number.NEGATIVE_INFINITY,
        men: (row) => row.player.coreStats.men ?? Number.NEGATIVE_INFINITY,
        soc: (row) => row.player.coreStats.soc ?? Number.NEGATIVE_INFINITY,
      };
      const disciplineId = getDisciplineIdFromSortKey(sortState?.key);
      if (disciplineId && sortState) {
        accessors[sortState.key] = (row) => row.player.disciplineRatings[disciplineId] ?? Number.NEGATIVE_INFINITY;
      }
      return sortRows(playersTableRows, sortState, accessors);
    },
    [input.shouldBuildPlayerDirectory, input.tableSorts.playersTable, playersTableRows],
  );

  useEffect(() => {
    if (!input.shouldBuildPlayerDirectory || !input.tableSorts.playersTable) {
      return;
    }
    const sortState = input.tableSorts.playersTable;
    const accessors: Record<string, (row: (typeof playersTableRows)[number]) => string | number> = {
      name: (row) => row.player.name,
      team: (row) => row.team?.name ?? (row.isFreeAgent ? "Free Agent" : ""),
      class: (row) => row.player.className,
      race: (row) => row.player.race,
      pps: (row) => row.playerPps ?? Number.NEGATIVE_INFINITY,
      ovr: (row) => row.playerOvr ?? Number.NEGATIVE_INFINITY,
      mvs: (row) => row.playerMvs ?? Number.NEGATIVE_INFINITY,
      mw: (row) => getPlayerDisplayMarketValue(row.player) ?? Number.NEGATIVE_INFINITY,
      salary: (row) => (row.roster ? getRosterEntrySalarySortValue(row.roster, row.player) : Number.NEGATIVE_INFINITY),
      contract: (row) => row.roster?.contractLength ?? 0,
      appearances: (row) => row.appearances ?? Number.NEGATIVE_INFINITY,
      bestDiscipline: (row) => row.bestDiscipline ?? "",
      careerLeague: (row) => row.careerLeagueStats?.totalPps ?? Number.NEGATIVE_INFINITY,
      traits: (row) => `${row.player.traitsPositive.join(", ")} ${row.player.traitsNegative.join(", ")}`.trim(),
      pow: (row) => row.player.coreStats.pow ?? Number.NEGATIVE_INFINITY,
      spe: (row) => row.player.coreStats.spe ?? Number.NEGATIVE_INFINITY,
      men: (row) => row.player.coreStats.men ?? Number.NEGATIVE_INFINITY,
      soc: (row) => row.player.coreStats.soc ?? Number.NEGATIVE_INFINITY,
    };
    const disciplineId = getDisciplineIdFromSortKey(sortState.key);
    if (disciplineId) {
      accessors[sortState.key] = (row) => row.player.disciplineRatings[disciplineId] ?? Number.NEGATIVE_INFINITY;
    }
    const accessor = accessors[sortState.key];
    if (!accessor) {
      return;
    }
    input.sortPlayerDirectoryRows(
      playersTableRows.map((row) => ({
        id: row.player.id,
        sortValues: { [sortState.key]: accessor(row) },
      })),
      sortState.key,
      sortState.direction,
    );
  }, [
    input.shouldBuildPlayerDirectory,
    input.sortPlayerDirectoryRows,
    input.tableSorts.playersTable,
    playersTableRows,
  ]);

  const displayedPlayersTableRows = useMemo(() => {
    if (!input.playerDirectoryOrderedIds?.length) {
      return sortedPlayersTableRows;
    }
    const byId = new Map(sortedPlayersTableRows.map((row) => [row.player.id, row] as const));
    return input.playerDirectoryOrderedIds
      .map((playerId) => byId.get(playerId))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [input.playerDirectoryOrderedIds, sortedPlayersTableRows]);

  const playerBracketCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    for (const row of playersTableScopeRows) {
      const mw = getPlayerDisplayMarketValue(row.player);
      const bracket = getTransfermarktBracket(mw);
      counts[bracket] = (counts[bracket] ?? 0) + 1;
    }
    return counts;
  }, [playersTableScopeRows]);

  return {
    leaguePlayerHeatPools,
    playerScopeRows,
    playerClassOptions,
    playersTableScopeRows,
    playersTableRows,
    sortedPlayersTableRows,
    displayedPlayersTableRows,
    playerBracketCounts,
  };
}
