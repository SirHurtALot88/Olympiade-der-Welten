"use client";

import type { FoundationActionFeedback } from "@/lib/foundation/tabs/foundation-page-types";
import dynamic from "next/dynamic";
import type { Dispatch, SetStateAction } from "react";

import FoundationPanelSkeleton from "@/components/foundation/FoundationPanelSkeleton";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import type {
  Discipline,
  GameState,
  Player,
  RosterEntry,
  Team,
  TeamControlMode,
  TeamSeasonObjectiveRecord,
  TransferWishlistEntry,
} from "@/lib/data/olyDataTypes";
import { setFoundationView } from "@/lib/foundation/foundation-navigation";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import {
  getScoutingWishlistSlotLimit,
  getTeamTransferWishlistEntries,
  isTeamSetupDraftWishlistPhase,
} from "@/lib/scouting/scouting-wishlist-slots";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import { useMarketV2Derivations } from "@/lib/foundation/tabs/use-market-v2-derivations";

const FoundationTransfermarktV2Panel = dynamic(
  () => import("@/app/foundation/transfermarkt-v2/FoundationTransfermarktV2Panel"),
  {
    ssr: false,
    loading: () => (
      <FoundationPanelSkeleton variant="marketV2" label="Transfermarkt wird geladen…" testId="transfer-market" id="transfer-market" />
    ),
  },
);

export type FoundationMarketV2ShellHostProps = {
  gameState: GameState;
  activeSaveId: string;
  activeSaveName: string;
  activeManagerTeamId: string | null;
  effectiveActiveOwnerId: string;
  foundationManageableTeamIds: string[];
  selectedTeam: Team | null;
  selectedTeamObjectives: TeamSeasonObjectiveRecord[];
  transferWishlistEntriesForMarketV2: TransferWishlistEntry[];
  marketVisibleFeedCount: number;
  marketActiveFreeAgentCount: number;
  sourceBadgeLabel: string;
  marketFocusPlayerId: string | null;
  foundationPanel: string | null;
  activeView: FoundationViewId;
  isFoundationBootstrapState: boolean;
  readMetaSource: "sqlite" | "prisma";
  resolvedTeamControlSettings: Record<
    string,
    { controlMode: TeamControlMode; ownerId?: string | null; ownerSlot?: string | null }
  >;
  playerRatingsById: Map<
    string,
    {
      ppsSeason?: number | null;
      ovrNormalized?: number | null;
      mvs?: number | null;
      ovrRank?: number | null;
      ppsSeasonRank?: number | null;
      mvsRank?: number | null;
    }
  >;
  seasonPointsLedger?: import("@/lib/foundation/season-points-ledger").SeasonPointsLedger | null;
  roomContext: FoundationRoomContext | null;
  formatGamePhaseLabel: (phase: string) => string;
  getRosterEntryDisplayMarketValue: (
    entry?: Pick<RosterEntry, "currentValue" | "purchasePrice"> | null,
    player?: Player | null,
  ) => number | null;
  getRosterEntryDisplaySalary: (entry: Pick<RosterEntry, "salary">, player?: Player | null) => number | null;
  getTeamLockedName: (teamId: string) => string;
  setActiveView: Dispatch<SetStateAction<FoundationViewId>>;
  setActiveManagerTeam: (
    teamId: string,
    source?: "manual_select" | "route" | "saved_preference" | "default_human_team",
  ) => void;
  setMarketFocusPlayerId: Dispatch<SetStateAction<string | null>>;
  setFoundationActionFeedback: Dispatch<SetStateAction<FoundationActionFeedback | null>>;
  openPlayerDrawerById: (playerId: string, activePlayerId?: string | null) => void;
  toggleTransferWishlist: (item: TransfermarktFreeAgentItem) => void;
  removeTransferWishlistEntry: (playerId: string) => void;
  toggleScoutingWatch: (item: TransfermarktFreeAgentItem) => void;
  openMarketOfferPanel: (playerId: string) => void;
  closeFoundationDrilldownPanel: () => void;
  openMarketSellModal: (payload: {
    activePlayerId: string;
    playerId: string;
    playerName: string;
    className: string;
    race: string;
    portraitUrl: string | null;
  }) => void;
  loadSave: (saveId: string) => Promise<void>;
};

/**
 * Market V2 shell host (Strangler Phase 5.3). Mounts market-only derivations and panel
 * wiring only while the transfermarkt tab is active.
 */
export default function FoundationMarketV2ShellHost({
  gameState,
  activeSaveId,
  activeSaveName,
  activeManagerTeamId,
  effectiveActiveOwnerId,
  foundationManageableTeamIds,
  selectedTeam,
  selectedTeamObjectives,
  transferWishlistEntriesForMarketV2,
  marketVisibleFeedCount,
  marketActiveFreeAgentCount,
  sourceBadgeLabel,
  marketFocusPlayerId,
  foundationPanel,
  activeView,
  isFoundationBootstrapState,
  readMetaSource,
  resolvedTeamControlSettings,
  playerRatingsById,
  seasonPointsLedger,
  roomContext,
  formatGamePhaseLabel,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getTeamLockedName,
  setActiveView,
  setActiveManagerTeam,
  setMarketFocusPlayerId,
  setFoundationActionFeedback,
  openPlayerDrawerById,
  toggleTransferWishlist,
  removeTransferWishlistEntry,
  toggleScoutingWatch,
  openMarketOfferPanel,
  closeFoundationDrilldownPanel,
  openMarketSellModal,
  loadSave,
}: FoundationMarketV2ShellHostProps) {
  const {
    transferWindowStatus,
    clientKey,
    transferMarketV2RosterRows,
    transferMarketScoutingWatchPlayerIds,
    transferMarketScoutingIntelByPlayerId,
    transferMarketActiveWishlistPlayerIds,
    selectedTransfermarktBoardObjectives,
  } = useMarketV2Derivations({
    gameState,
    activeSaveId,
    activeManagerTeamId,
    playerRatingsById,
    seasonPointsLedger,
    selectedTeamObjectives,
    getRosterEntryDisplayMarketValue,
    getRosterEntryDisplaySalary,
  });

  return (
    <FoundationTransfermarktV2Panel
      active
      transferWindowStatus={transferWindowStatus}
      marketVisibleFeedCount={marketVisibleFeedCount}
      marketActiveFreeAgentCount={marketActiveFreeAgentCount}
      sourceBadgeLabel={sourceBadgeLabel}
      activeSaveName={activeSaveName}
      seasonId={gameState.season.id}
      selectedTeamLabel={selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : "—"}
      formatGamePhaseLabel={formatGamePhaseLabel}
      clientKey={clientKey}
      client={{
        defaultSaveId: activeSaveId,
        defaultSeasonId: gameState.season.id,
        bootstrapReady: !isFoundationBootstrapState,
        defaultTeamId: activeManagerTeamId,
        source: readMetaSource,
        activeOwnerId: effectiveActiveOwnerId,
        manageableTeamIds: foundationManageableTeamIds,
        teamControlModesByTeamId: Object.fromEntries(
          Object.entries(resolvedTeamControlSettings).map(([teamId, settings]) => [teamId, settings.controlMode]),
        ),
        teamControlOwnersByTeamId: Object.fromEntries(
          Object.entries(resolvedTeamControlSettings).map(([teamId, settings]) => [
            teamId,
            {
              ownerId: settings.ownerId ?? null,
              ownerSlot: settings.ownerSlot ?? null,
            },
          ]),
        ),
        teams: gameState.teams,
        disciplines: gameState.disciplines as Discipline[],
        rosterRows: transferMarketV2RosterRows,
        playerRatingsById,
        wishlistEntries: transferWishlistEntriesForMarketV2,
        wishlistPlayerIds: transferWishlistEntriesForMarketV2.map((entry) => entry.playerId),
        boardObjectiveHighlights: selectedTransfermarktBoardObjectives,
        onOpenPlayerDetails: (payload) => openPlayerDrawerById(payload.playerId, payload.activePlayerId),
        onOpenHistory: () => setFoundationView("historyV2", setActiveView),
        onToggleWishlist: (item) => {
          toggleTransferWishlist(item);
        },
        onRemoveWishlist: (playerId) => {
          removeTransferWishlistEntry(playerId);
        },
        scoutingWatchPlayerIds: transferMarketScoutingWatchPlayerIds,
        scoutingIntelByPlayerId: transferMarketScoutingIntelByPlayerId,
        scoutingActiveWishlistPlayerIds: transferMarketActiveWishlistPlayerIds,
        scoutingPipelineCapacity: activeManagerTeamId
          ? {
              occupied: getTeamTransferWishlistEntries(gameState, activeManagerTeamId).length,
              max: getScoutingWishlistSlotLimit(gameState, activeManagerTeamId),
              draftSuspended: isTeamSetupDraftWishlistPhase(gameState, activeManagerTeamId),
            }
          : null,
        onToggleScoutingWatch: (item) => {
          toggleScoutingWatch(item);
        },
        initialPlayerId: marketFocusPlayerId,
        onInitialPlayerFocusConsumed: () => setMarketFocusPlayerId(null),
        offerPanelActive: foundationPanel === "offer" && activeView === "marketV2",
        onOpenOfferPanel: openMarketOfferPanel,
        onCloseOfferPanel: closeFoundationDrilldownPanel,
        roomContext,
        onBuyCompleted: async (teamId) => {
          setActiveManagerTeam(teamId, "manual_select");
          setFoundationActionFeedback({
            tone: "success",
            title: "Kauf abgeschlossen",
            detail: `${getTeamLockedName(teamId)} wurde aktualisiert. Cash, Gehalt, Kader und Marktfeed sind neu geladen.`,
          });
          await loadSave(activeSaveId);
        },
        onSell: (payload) => {
          void openMarketSellModal({
            activePlayerId: payload.activePlayerId,
            playerId: payload.playerId,
            playerName: payload.playerName,
            className: payload.className,
            race: payload.race ?? "",
            portraitUrl: payload.portraitUrl ?? null,
          });
        },
      }}
    />
  );
}
