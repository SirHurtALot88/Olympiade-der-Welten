"use client";

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
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";

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
  playerRatingsById: Map<string, PlayerRatingContractRow>;
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
  setFoundationActionFeedback: Dispatch<
    SetStateAction<{ tone: "success" | "warning" | "error"; title: string; detail: string } | null>
  >;
  openPlayerDrawerById: (playerId: string, activePlayerId?: string | null) => void;
  toggleTransferWishlist: (item: TransfermarktFreeAgentItem) => void;
  removeTransferWishlistEntry: (playerId: string) => void;
  toggleScoutingWatch: (item: TransfermarktFreeAgentItem) => void;
  openMarketOfferPanel: (playerId: string) => void;
  /** Haelt den Shell-Zustand mit der Listenauswahl gleich — sonst bleibt die Hauptaktion blind. */
  onSelectMarketCandidate: (playerId: string, name: string) => void;
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
  /**
   * Übernimmt einen bereits vom Server aufbereiteten Spielstand (z. B. `gameStateAfter` aus der
   * Kauf-Antwort) direkt in den React-State — ohne ihn nochmal per `loadSave` über das Netz zu
   * holen. Dieselbe Aufbereitung (Normalisierung, Board-Zielzustände, Kompakt-Sentinel) wie
   * `loadSave`, siehe `normalizeLoadedFoundationGameState` / `commitFreshlyLoadedGameState` in
   * `use-foundation-persistence-actions.ts`.
   */
  applyGameStateFromGameplayResponse: (rawGameState: GameState) => GameState;
  /**
   * Stoesst den Markt-Feed neu an. Der Feed haengt NICHT am Spielstand, sondern an einem
   * eigenen Zaehler — ohne diesen Anstoss bleibt er nach einem Kauf auf dem alten Stand.
   */
  bumpMarketReloadToken: () => void;
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
  onSelectMarketCandidate,
  closeFoundationDrilldownPanel,
  openMarketSellModal,
  loadSave,
  applyGameStateFromGameplayResponse,
  bumpMarketReloadToken,
}: FoundationMarketV2ShellHostProps) {
  const {
    transferWindowStatus,
    clientKey,
    transferMarketV2RosterRows,
    transferMarketScoutingWatchPlayerIds,
    transferMarketScoutingIntelByPlayerId,
    transferMarketActiveWishlistPlayerIds,
    selectedTransfermarktBoardObjectives,
    transferMarketDisciplineRanksByTeamId,
  } = useMarketV2Derivations({
    gameState,
    activeSaveId,
    activeManagerTeamId,
    manageableTeamIds: foundationManageableTeamIds,
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
        disciplineRanksByTeamId: transferMarketDisciplineRanksByTeamId,
        leagueTeamCount: gameState.teams.length,
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
        onSelectCandidate: onSelectMarketCandidate,
        onCloseOfferPanel: closeFoundationDrilldownPanel,
        roomContext,
        /**
         * GEMELDET: „cash anzeige updated sich nicht nach kauf eines spielers".
         *
         * Der Kauf lud nur den SPIELSTAND neu (`loadSave`). Die Cash-Zahl im Transfermarkt
         * kommt aber aus `marketFeed.teamContext.teamCash`, und der Markt-Feed haengt an
         * einem eigenen Zaehler (`marketReloadToken`) — nicht am Spielstand. Nach einem
         * Kauf aendert sich keine seiner uebrigen Abhaengigkeiten (gleicher Save, gleiche
         * Ansicht, gleiche Saison, gleiches Team), also lief der Effekt nicht noch einmal
         * und die Zahl blieb auf dem Stand VOR dem Kauf stehen.
         *
         * Die Erfolgsmeldung behauptete dabei ausdruecklich, der Marktfeed sei neu geladen.
         * Das war die einzige Stelle, an der der Widerspruch ueberhaupt sichtbar wurde — Grund
         * genug, hier unten genau zu sagen was jeweils WIRKLICH passiert, statt eine pauschale
         * Behauptung stehen zu lassen (siehe `stateAppliedFromResponse` unten).
         *
         * `bumpMarketReloadToken()` laeuft in JEDEM Fall — der Marktfeed haengt wie oben
         * beschrieben an seinem eigenen Zaehler, nicht am Spielstand, und muss deshalb immer
         * separat angestossen werden, egal ob der Spielstand selbst per Antwort uebernommen
         * oder per `loadSave` neu geholt wurde.
         */
        onBuyCompleted: async ({ teamId, gameStateAfter }) => {
          setActiveManagerTeam(teamId, "manual_select");
          // Der Kauf-Endpunkt hat den Folgezustand oft schon fertig berechnet mitgeschickt
          // (`gameStateAfter`) — dann wird er direkt uebernommen, statt den ganzen Spielstand
          // nochmal ueber `loadSave` zu holen. Fehlt er (alter Server, Fehler), greift
          // unveraendert der volle Reload.
          const stateAppliedFromResponse = gameStateAfter != null;
          setFoundationActionFeedback({
            tone: "success",
            title: "Kauf abgeschlossen",
            detail: stateAppliedFromResponse
              ? `${getTeamLockedName(teamId)} wurde aktualisiert. Cash, Gehalt und Kader stammen direkt aus der Kauf-Antwort, der Marktfeed lädt neu.`
              : `${getTeamLockedName(teamId)} wurde aktualisiert. Cash, Gehalt, Kader und Marktfeed sind neu geladen.`,
          });
          if (gameStateAfter) {
            applyGameStateFromGameplayResponse(gameStateAfter);
          } else {
            await loadSave(activeSaveId);
          }
          bumpMarketReloadToken();
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
