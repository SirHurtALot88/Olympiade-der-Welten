import { useMemo } from "react";

import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { TeamFacilityCollection } from "@/lib/facilities/facility-effects";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import {
  getPlayerDisplayMarketValue,
  getPlayerDisplaySalary,
} from "@/lib/foundation/tabs/season-stand-render-helpers";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import { getTransfermarktScoutingVisibilityBuckets } from "@/lib/market/transfermarkt-scouting";
import { getFacilityLevel } from "@/lib/facilities/facility-effects";
import { buildScoutingWatchTargetStarFields } from "@/lib/scouting/player-star-scouting-bridge";
import {
  buildScoutingHubTargetSections,
  buildScoutingQueueEntries,
  type ScoutingHubTargetDraft,
  type ScoutingQueueEntryDraft,
} from "@/lib/scouting/scouting-hub-targets-service";
import { getScoutFocusSummary } from "@/lib/scouting/facility-scout-pipeline-service";
import { buildScoutingReport, type ScoutingReportData } from "@/lib/scouting/scouting-report-service";

export type FoundationTransferWishlistEntryForMarketV2 = {
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  bracket?: number | null;
  marketValue?: number | null;
  salary?: number | null;
  pow?: number | null;
  spe?: number | null;
  men?: number | null;
  soc?: number | null;
};

export function shouldBuildFoundationTransferWishlistDerivations(shouldBuildMarketView: boolean): boolean {
  return shouldBuildMarketView;
}

export function shouldBuildFoundationTransferSellMarkerDerivations(input: {
  shouldBuildMarketView: boolean;
  shouldBuildTeamsView: boolean;
  shouldBuildHomeV2Overview: boolean;
}): boolean {
  return input.shouldBuildMarketView || input.shouldBuildTeamsView || input.shouldBuildHomeV2Overview;
}

export function shouldBuildFoundationScoutingHubDerivations(input: {
  shouldBuildMarketView: boolean;
  shouldBuildScoutingHubView: boolean;
}): boolean {
  return input.shouldBuildMarketView || input.shouldBuildScoutingHubView;
}

export function shouldBuildFoundationHqTransferMarkerDerivations(shouldBuildHomeV2Overview: boolean): boolean {
  return shouldBuildHomeV2Overview;
}

export function useFoundationCrossTabMarketFilters(input: {
  activeView: FoundationViewId;
  shouldBuildMarketView: boolean;
  shouldBuildScoutingHubView: boolean;
  shouldBuildTeamsView: boolean;
  shouldBuildHomeV2Overview: boolean;
  activeSaveId: string;
  gameState: GameState;
  selectedTeam: Team | null;
  selectedTeamFacilityState: TeamFacilityCollection;
  scoutingReportSelectedPlayerId?: string | null;
  selectedRosterTableRows: Array<{
    entry: { contractLength: number };
    player: { currentXP?: number | null; fatigue?: number | null };
    playerId?: string;
  }>;
}) {
  const shouldBuildTransferWishlist = shouldBuildFoundationTransferWishlistDerivations(input.shouldBuildMarketView);
  const shouldBuildTransferSellMarkers = shouldBuildFoundationTransferSellMarkerDerivations({
    shouldBuildMarketView: input.shouldBuildMarketView,
    shouldBuildTeamsView: input.shouldBuildTeamsView,
    shouldBuildHomeV2Overview: input.shouldBuildHomeV2Overview,
  });
  const shouldBuildScoutingHub = shouldBuildFoundationScoutingHubDerivations({
    shouldBuildMarketView: input.shouldBuildMarketView,
    shouldBuildScoutingHubView: input.shouldBuildScoutingHubView,
  });
  const shouldBuildHqTransferMarkers = shouldBuildFoundationHqTransferMarkerDerivations(input.shouldBuildHomeV2Overview);

  const transferWishlistEntries = useMemo(
    () =>
      shouldBuildTransferWishlist
        ? (input.gameState.seasonState.transferWishlist ?? []).filter((entry) => entry.saveId === input.activeSaveId)
        : [],
    [input.activeSaveId, input.gameState.seasonState.transferWishlist, shouldBuildTransferWishlist],
  );

  const transferSellMarkerEntries = useMemo(
    () =>
      shouldBuildTransferSellMarkers
        ? (input.gameState.seasonState.transferSellMarkers ?? []).filter(
            (entry) => entry.saveId === input.activeSaveId && entry.seasonId === input.gameState.season.id,
          )
        : [],
    [
      input.activeSaveId,
      input.gameState.season.id,
      input.gameState.seasonState.transferSellMarkers,
      shouldBuildTransferSellMarkers,
    ],
  );

  const transferSellMarkerKeySet = useMemo(
    () => new Set(transferSellMarkerEntries.map((entry) => `${entry.teamId}:${entry.playerId}`)),
    [transferSellMarkerEntries],
  );

  const transferWishlistEntriesForMarketV2 = useMemo((): FoundationTransferWishlistEntryForMarketV2[] => {
    if (!shouldBuildTransferWishlist) {
      return [];
    }

    const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
    return transferWishlistEntries.map((entry) => {
      const player = playersById.get(entry.playerId) ?? null;
      return {
        ...entry,
        className: entry.className || player?.className || "—",
        race: entry.race || player?.race || "—",
        marketValue: entry.marketValue ?? (player ? getPlayerDisplayMarketValue(player) : null) ?? null,
        salary: entry.salary ?? (player ? getPlayerDisplaySalary(player) : null) ?? null,
        pow: player?.coreStats.pow ?? entry.pow ?? null,
        spe: player?.coreStats.spe ?? entry.spe ?? null,
        men: player?.coreStats.men ?? entry.men ?? null,
        soc: player?.coreStats.soc ?? entry.soc ?? null,
      };
    });
  }, [input.gameState.players, shouldBuildTransferWishlist, transferWishlistEntries]);

  const scoutingHubV2TargetSections = useMemo(() => {
    if (!shouldBuildScoutingHub || !input.selectedTeam) {
      return { activeTargets: [] as ScoutingHubTargetDraft[], bookmarkedTargets: [] as ScoutingHubTargetDraft[] };
    }

    const facilityLevel = getFacilityLevel(input.selectedTeamFacilityState, "scouting_office");
    const sections = buildScoutingHubTargetSections({
      gameState: input.gameState,
      teamId: input.selectedTeam.teamId,
      resolveMarketEntry: (playerId) => {
        const entry = transferWishlistEntriesForMarketV2.find((candidate) => candidate.playerId === playerId);
        if (!entry) {
          return null;
        }
        return {
          playerName: entry.playerName,
          className: entry.className,
          marketValue: entry.marketValue != null ? formatTransfermarktCurrency(entry.marketValue) : "—",
          pow: entry.pow ?? null,
          spe: entry.spe ?? null,
          men: entry.men ?? null,
          soc: entry.soc ?? null,
          salary: entry.salary ?? null,
        };
      },
    });
    const playerById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
    const enrichTarget = (draft: (typeof sections.activeTargets)[number]) => {
      const player = playerById.get(draft.playerId);
      const scoutingLevel = sections.getScoutingLevelForPlayer(draft.playerId, facilityLevel);
      const starFields =
        player != null
          ? buildScoutingWatchTargetStarFields({
              gameState: sections.syncedState,
              player,
              saveId: input.activeSaveId,
              scoutingLevel,
            })
          : null;
      return {
        ...draft,
        ...starFields,
      };
    };
    return {
      activeTargets: sections.activeTargets.map(enrichTarget),
      bookmarkedTargets: sections.bookmarkedTargets.map(enrichTarget),
    };
  }, [
    input.activeSaveId,
    input.gameState,
    input.selectedTeam,
    input.selectedTeamFacilityState,
    shouldBuildScoutingHub,
    transferWishlistEntriesForMarketV2,
  ]);

  const scoutingQueueEntries = useMemo((): ScoutingQueueEntryDraft[] => {
    if (!shouldBuildScoutingHub || !input.selectedTeam) {
      return [];
    }
    return buildScoutingQueueEntries({
      gameState: input.gameState,
      teamId: input.selectedTeam.teamId,
      resolveMarketEntry: (playerId) => {
        const entry = transferWishlistEntriesForMarketV2.find((candidate) => candidate.playerId === playerId);
        if (!entry) {
          return null;
        }
        return {
          playerName: entry.playerName,
          className: entry.className,
          race: entry.race,
          marketValue: entry.marketValue != null ? formatTransfermarktCurrency(entry.marketValue) : "—",
        };
      },
    });
  }, [input.gameState, input.selectedTeam, shouldBuildScoutingHub, transferWishlistEntriesForMarketV2]);

  const scoutingFocusSummary = useMemo(() => {
    if (!shouldBuildScoutingHub || !input.selectedTeam) {
      return null;
    }
    return getScoutFocusSummary(input.gameState, input.selectedTeam.teamId);
  }, [input.gameState, input.selectedTeam, shouldBuildScoutingHub]);

  const scoutingReportPlayerId = input.scoutingReportSelectedPlayerId ?? scoutingFocusSummary?.playerId ?? scoutingQueueEntries[0]?.playerId ?? null;

  const scoutingReport = useMemo((): ScoutingReportData | null => {
    if (!shouldBuildScoutingHub || !input.selectedTeam || !scoutingReportPlayerId) {
      return null;
    }
    return buildScoutingReport({
      gameState: input.gameState,
      teamId: input.selectedTeam.teamId,
      playerId: scoutingReportPlayerId,
      saveId: input.activeSaveId,
    });
  }, [input.activeSaveId, input.gameState, input.selectedTeam, scoutingReportPlayerId, shouldBuildScoutingHub]);

  const scoutingHubV2Visibility = useMemo(() => {
    if (!shouldBuildScoutingHub) {
      return {
        scoutingLevel: 0,
        visibleAtTier: [] as string[],
        hiddenAtTier: [] as string[],
        baseInfoAlwaysVisible: [] as string[],
      };
    }

    const scoutingLevel = getFacilityLevel(input.selectedTeamFacilityState, "scouting_office");
    const buckets = getTransfermarktScoutingVisibilityBuckets(scoutingLevel);
    return {
      scoutingLevel,
      visibleAtTier: buckets.scouted,
      hiddenAtTier: buckets.hidden,
      baseInfoAlwaysVisible: buckets.knowledge,
    };
  }, [input.selectedTeamFacilityState, shouldBuildScoutingHub]);

  const hqTransferWishlistEntries = useMemo(
    () =>
      shouldBuildHqTransferMarkers
        ? (input.gameState.seasonState.transferWishlist ?? [])
            .filter(
              (entry) =>
                entry.saveId === input.activeSaveId &&
                (!input.selectedTeam || entry.teamId == null || entry.teamId === input.selectedTeam.teamId),
            )
            .slice(0, 4)
        : [],
    [
      input.activeSaveId,
      input.gameState.seasonState.transferWishlist,
      input.selectedTeam,
      shouldBuildHqTransferMarkers,
    ],
  );

  const hqTransferSellMarkers = useMemo(
    () =>
      shouldBuildHqTransferMarkers
        ? transferSellMarkerEntries.filter((entry) => entry.teamId === input.selectedTeam?.teamId).slice(0, 4)
        : [],
    [input.selectedTeam?.teamId, shouldBuildHqTransferMarkers, transferSellMarkerEntries],
  );

  const hqContractExpiringCount = useMemo(
    () =>
      shouldBuildHqTransferMarkers
        ? input.selectedRosterTableRows.filter((row) => row.entry.contractLength <= 1).length
        : 0,
    [input.selectedRosterTableRows, shouldBuildHqTransferMarkers],
  );

  const hqTrainingFocusCount = useMemo(
    () =>
      shouldBuildHqTransferMarkers
        ? input.selectedRosterTableRows.filter(
            (row) => (row.player.currentXP ?? 0) > 0 || (row.player.fatigue ?? 0) > 0,
          ).length
        : 0,
    [input.selectedRosterTableRows, shouldBuildHqTransferMarkers],
  );

  return {
    transferWishlistEntries,
    transferSellMarkerEntries,
    transferSellMarkerKeySet,
    transferWishlistEntriesForMarketV2,
    scoutingHubV2TargetSections,
    scoutingHubV2Visibility,
    scoutingQueueEntries,
    scoutingFocusSummary,
    scoutingReport,
    hqTransferWishlistEntries,
    hqTransferSellMarkers,
    hqContractExpiringCount,
    hqTrainingFocusCount,
  };
}
