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
import {
  buildRosterDisciplinePpsByAxis,
  type RosterAxisDisciplinePps,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-teams-roster";
import type { PlayerTableScope } from "@/lib/foundation/tabs/foundation-page-types";
import {
  getPlayerDisplayMarketValue,
  getRosterEntrySalarySortValue,
} from "@/lib/foundation/tabs/season-stand-render-helpers";
import {
  buildExpectedSellValueByPlayerId,
  type ExpectedSellValueEntry,
} from "@/lib/market/transfermarkt-expected-sell-value";
import { getTransfermarktBracket } from "@/lib/market/transfermarkt-fit";
import { resolvePlayerPotentialRecordFromGameState } from "@/lib/scouting/player-attribute-ceiling-service";

export type FoundationPlayerScopeRow = {
  player: Player;
  roster: RosterEntry | null;
  team: Team | null;
  seasonPerformance: {
    appearances: number;
    totalPoints: number | null;
    bestDisciplineLabel: string | null;
  } | null;
  /** Echter Potenzial-Score (hiddenPotentialScore) für den kanonischen PO-Stern. */
  potentialScore: number | null;
  playerOvr: number | null;
  /** Ligaweiter OVR-Rang — einzige Grundlage des Star-Tier-Rahmens am Portrait (siehe `player-star-tier.ts`). */
  ovrRank: number | null;
  playerMvs: number | null;
  playerPps: number | null;
  /**
   * ECHTE Performance-Punkte je Achse (nicht die Kernwerte 0–100). Die
   * PPs-Aufschlüsselung in der Spielerliste zeigte bisher `player.coreStats`
   * als „Näherung", weil diese Werte hier nicht durchgereicht waren — die vier
   * Balken summierten sich also nie auf den Gesamt-PPs-Wert darüber. Sie liegen
   * in derselben `playerRatingsById`-Karte, aus der schon OVR/MVS/PPs kommen.
   */
  axisPps: { pow: number | null; spe: number | null; men: number | null; soc: number | null };
  /**
   * Erwarteter Verkaufserlös (Brutto laut Sale-Factor, offener Buyout, Netto) —
   * bewusst NICHT nochmal der Marktwert (den zeigt die MW-Spalte schon), sondern
   * das, was ein Verkauf JETZT wirklich einbrächte. Einmalig für alle Zeilen
   * batch-berechnet (`buildExpectedSellValueByPlayerId`) statt eines Server-
   * Previews pro Zeile. `null` für Free Agents (kein Kader → kein Verkauf) und
   * ohne belastbaren Marktwert — dort zeigt die Spalte "—" statt einer Schätzung.
   */
  sellPreview: ExpectedSellValueEntry | null;
  /**
   * Dieselben PP eine Ebene tiefer: je Achse zusätzlich die zugehörigen
   * Disziplinen aus dem Saison-Punkte-Ledger — Grundlage der aufklappbaren
   * Achsen-Spalten. Gleiche Quelle und gleicher Builder wie in der
   * Teams-Detailansicht, damit beide Ansichten nicht auseinanderlaufen; die
   * Achsentotals darin stammen aus denselben `ppPow`/`ppSpe`/… wie `axisPps`.
   */
  disciplinePpsByAxis: RosterAxisDisciplinePps[];
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

/**
 * Sortier-Schlüssel für "nach den in einer Disziplin GEHOLTEN PPs sortieren"
 * (aufklappbare Achsen-Spalten im Spieler-Verzeichnis). Bewusst ein eigener
 * Präfix neben `discipline:` — dort steht die Disziplin-WERTUNG (0–100,
 * `player.disciplineRatings`), hier die tatsächlich erzielten
 * Performance-Punkte aus dem Saison-Ledger (`row.disciplinePpsByAxis`).
 * Die beiden Präfixe kollidieren nicht: `disciplinePps:` beginnt nicht mit
 * `discipline:` (Zeichen 11 ist `P` statt `:`).
 */
const DISCIPLINE_PPS_SORT_KEY_PREFIX = "disciplinePps:";

export function buildDisciplinePpsSortKey(disciplineId: string): string {
  return `${DISCIPLINE_PPS_SORT_KEY_PREFIX}${disciplineId}`;
}

export function getDisciplineIdFromPpsSortKey(sortKey: string | null | undefined): string | null {
  if (!sortKey || !sortKey.startsWith(DISCIPLINE_PPS_SORT_KEY_PREFIX)) {
    return null;
  }
  return sortKey.slice(DISCIPLINE_PPS_SORT_KEY_PREFIX.length);
}

/**
 * In einer Disziplin erzielte PPs einer Verzeichniszeile (`null`, wenn die
 * Disziplin nicht im Katalog der Zeile steckt). Liest ausschließlich die
 * bereits gebaute `disciplinePpsByAxis`-Struktur — rechnet nichts neu.
 */
export function getRowDisciplinePps(
  row: Pick<FoundationPlayerScopeRow, "disciplinePpsByAxis">,
  disciplineId: string,
): number | null {
  for (const axis of row.disciplinePpsByAxis) {
    for (const discipline of axis.disciplines) {
      if (discipline.id === disciplineId) {
        return discipline.pps;
      }
    }
  }
  return null;
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
    /** Disziplin-ID → in dieser Saison geholte PPs, je Spieler (Server-Ledger). */
    disciplinePointsByPlayerId: Record<string, Record<string, number>>;
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
    // EIN Batch-Lauf für alle Kaderspieler (der Sale-Factor-Rank-Kontext ist pro
    // GameState gecacht) — ein Preview-Aufruf pro Zeile wäre bei ~330 Zeilen zu teuer.
    const sellValueByPlayerId = buildExpectedSellValueByPlayerId(input.gameState);
    // Sobald der Directory-Slice da ist, ist ER die Quelle der Disziplin-PPs:
    // Der Slice rechnet SERVERSEITIG auf dem vollständigen Save, der Client hält
    // dagegen den kompakten Payload (`compactFoundationInitialGameState`), in dem
    // `matchdayResults`/`disciplineResults` auf den AKTIVEN Spieltag beschnitten
    // sind. Ein clientseitiger `seasonPointsLedger` kennt daher nur diesen einen
    // Spieltag und ist, solange er nicht ausgewertet ist, leer — genau das ließ
    // in den aufgeklappten Achsen-Spalten überall "—" stehen, während PPS/OVR
    // (aus demselben Slice) längst echte Saisonwerte zeigten.
    const useSliceDisciplinePoints =
      Boolean(input.playerDirectorySlice.payload) && !input.playerDirectorySlice.error;

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
        // Echter Potenzial-Score (nicht die driftende player.potential-Kopie), damit der
        // PO-Stern der Spielerliste mit Kader/Scouting/Profil übereinstimmt.
        const potentialRecord = resolvePlayerPotentialRecordFromGameState({
          gameState: input.gameState,
          playerId: player.id,
        });

        return {
          player,
          roster,
          team,
          seasonPerformance,
          potentialScore: potentialRecord?.hiddenPotentialScore ?? player.potential ?? null,
          playerOvr: playerRating?.ovrNormalized ?? null,
          ovrRank: playerRating?.ovrRank ?? null,
          playerMvs: playerRating?.mvs ?? null,
          playerPps: playerRating?.ppsSeason ?? null,
          axisPps: {
            pow: playerRating?.ppPow ?? null,
            spe: playerRating?.ppSpe ?? null,
            men: playerRating?.ppMen ?? null,
            soc: playerRating?.ppSoc ?? null,
          },
          // Achsentotals bewusst aus denselben `ppPow`/`ppSpe`/… wie `axisPps`
          // oben — Achsen-Spalte und aufgeklappte Disziplin-Spalten dürfen nicht
          // aus zwei verschiedenen Quellen stammen.
          disciplinePpsByAxis: (() => {
            const ledgerSummary = input.seasonPointsLedger?.playerSummariesByPlayerId?.get(player.id) ?? null;
            // Slice zuerst (siehe Kommentar oben), Ledger nur als Fallback für
            // Pfade ohne Slice (z. B. Vollzustand nach Slice-Fehler). Fehlt der
            // Spieler im Slice, hat er in dieser Saison keine PPs geholt — das
            // bleibt bewusst leer statt auf den beschnittenen Ledger zurückzufallen.
            const pointsByDiscipline = useSliceDisciplinePoints
              ? input.playerDirectorySlice.disciplinePointsByPlayerId[player.id] ?? null
              : ledgerSummary?.pointsByDiscipline ?? null;
            return buildRosterDisciplinePpsByAxis({
              disciplines: input.gameState.disciplines,
              pointsByDiscipline,
              pointsByArea: ledgerSummary?.pointsByArea ?? null,
              axisTotals: {
                pow: playerRating?.ppPow ?? null,
                spe: playerRating?.ppSpe ?? null,
                men: playerRating?.ppMen ?? null,
                soc: playerRating?.ppSoc ?? null,
              },
            });
          })(),
          sellPreview: sellValueByPlayerId.get(player.id) ?? null,
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
    // Ganzer GameState als Dependency: `buildExpectedSellValueByPlayerId` und
    // `resolvePlayerPotentialRecordFromGameState` lesen mehr als players/rosters/teams
    // (Matchday-Results, Freeze-Snapshot, Verträge) — Teil-Deps würden veralten.
    input.gameState,
    input.gameState.players,
    input.gameState.rosters,
    input.gameState.teams,
    // Die Disziplin-PPs-Quellen gehören ZWINGEND in die Deps: sie werden im
    // Memo gelesen (`disciplinePpsByAxis`), trafen aber erst nach der ersten
    // Zeilenberechnung ein — ohne Dep wären die Zeilen mit leeren PPs eingefroren.
    input.playerDirectorySlice.disciplinePointsByPlayerId,
    input.playerDirectorySlice.error,
    input.playerDirectorySlice.payload,
    input.playerDirectorySlice.performanceByPlayerId,
    input.playerRatingsById,
    input.playerScope,
    input.playerSeasonPerformanceMap,
    input.seasonPointsLedger,
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
        sellValue: (row) => row.sellPreview?.grossSalePrice ?? Number.NEGATIVE_INFINITY,
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
      const disciplinePpsId = getDisciplineIdFromPpsSortKey(sortState?.key);
      if (disciplinePpsId && sortState) {
        accessors[sortState.key] = (row) => getRowDisciplinePps(row, disciplinePpsId) ?? Number.NEGATIVE_INFINITY;
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
      sellValue: (row) => row.sellPreview?.grossSalePrice ?? Number.NEGATIVE_INFINITY,
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
    const disciplinePpsId = getDisciplineIdFromPpsSortKey(sortState.key);
    if (disciplinePpsId) {
      accessors[sortState.key] = (row) => getRowDisciplinePps(row, disciplinePpsId) ?? Number.NEGATIVE_INFINITY;
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
