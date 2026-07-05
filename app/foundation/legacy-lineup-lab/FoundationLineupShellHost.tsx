"use client";

import type { ComponentProps, Dispatch, SetStateAction } from "react";

import FoundationLineupPanel from "@/app/foundation/legacy-lineup-lab/FoundationLineupPanel";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import { setFoundationView } from "@/lib/foundation/foundation-navigation";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import {
  type LineupDraftBoardView,
  useLineupDerivations,
} from "@/lib/foundation/tabs/use-lineup-derivations";

type LegacyLineupLabClientProps = ComponentProps<typeof FoundationLineupPanel>["client"];

type LineupSavedPayload = NonNullable<LegacyLineupLabClientProps["onLineupSaved"]> extends (
  payload: infer P,
) => void
  ? P
  : never;

type FormCardPlanSavedPayload = NonNullable<LegacyLineupLabClientProps["onFormCardPlanSaved"]> extends (
  payload: infer P,
) => void
  ? P
  : never;

export type FoundationLineupShellHostProps = {
  activeView: Extract<FoundationViewId, "lineup" | "lineupV2">;
  selectedTeam: Team | null;
  selectedTeamControlMode?: string | null;
  activeSaveId: string;
  activeSaveName: string;
  gameState: GameState;
  activeManagerTeamId: string | null;
  effectiveActiveOwnerId: string;
  foundationManageableTeamIds: string[];
  lineupFocusRequestKey: string | null;
  lineupDraftBoardViewRequest: LineupDraftBoardView | null;
  lineupDraftBoardView: LineupDraftBoardView;
  setLineupDraftBoardView: Dispatch<SetStateAction<LineupDraftBoardView>>;
  setLineupDraftBoardViewRequest: Dispatch<SetStateAction<LineupDraftBoardView | null>>;
  setActiveView: Dispatch<SetStateAction<FoundationViewId>>;
  setActiveManagerTeam: (
    teamId: string,
    source?: "manual_select" | "route" | "saved_preference" | "default_human_team",
  ) => void;
  openPlayerDrawerById: (playerId: string, activePlayerId?: string | null) => void;
  handleHumanLineupSaved: (payload: LineupSavedPayload) => void;
  handleFormCardPlanSaved: (payload: FormCardPlanSavedPayload) => void;
  roomContext: FoundationRoomContext | null;
  syncFoundationViewInUrl: (
    view: string,
    subView?: string | null,
    entityId?: string | null,
    options?: { push?: boolean },
  ) => void;
};

/**
 * Lineup shell host (Strangler Phase 5.3). Mounts lineup-only derivations and panel
 * wiring only while the lineup tab is active.
 */
export default function FoundationLineupShellHost({
  activeView,
  selectedTeam,
  selectedTeamControlMode,
  activeSaveId,
  activeSaveName,
  gameState,
  activeManagerTeamId,
  effectiveActiveOwnerId,
  foundationManageableTeamIds,
  lineupFocusRequestKey,
  lineupDraftBoardViewRequest,
  lineupDraftBoardView,
  setLineupDraftBoardView,
  setLineupDraftBoardViewRequest,
  setActiveView,
  setActiveManagerTeam,
  openPlayerDrawerById,
  handleHumanLineupSaved,
  handleFormCardPlanSaved,
  roomContext,
  syncFoundationViewInUrl,
}: FoundationLineupShellHostProps) {
  const { variant, clientKey, teamTooltip, effectiveDraftBoardView, highlightMissingSlots } = useLineupDerivations({
    activeView,
    selectedTeam,
    selectedTeamControlMode,
    activeSaveId,
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId,
    activeManagerTeamId,
    effectiveActiveOwnerId,
    lineupFocusRequestKey,
    lineupDraftBoardViewRequest,
    lineupDraftBoardView,
  });

  return (
    <FoundationLineupPanel
      active
      uiVariant={variant}
      clientKey={clientKey}
      teamTooltip={teamTooltip}
      client={{
        embedded: true,
        initialSource: "sqlite",
        defaultSaveId: activeSaveId,
        defaultSaveName: activeSaveName,
        defaultSeasonId: gameState.season.id,
        defaultMatchdayId: gameState.matchdayState.matchdayId,
        defaultTeamId: activeManagerTeamId,
        highlightMissingSlots,
        focusMissingRequestKey: lineupFocusRequestKey,
        draftBoardView: effectiveDraftBoardView,
        onDraftBoardViewChange: (view) => {
          setLineupDraftBoardView(view);
          setLineupDraftBoardViewRequest(null);
          syncFoundationViewInUrl(activeView, view === "formBoard" ? "formplan" : "lineup", null, { push: true });
        },
        shellControlledDraftBoardView: true,
        initialDraftBoardView: lineupDraftBoardViewRequest ?? undefined,
        onDraftBoardViewApplied: () => setLineupDraftBoardViewRequest(null),
        activeOwnerId: effectiveActiveOwnerId,
        manageableTeamIds: foundationManageableTeamIds,
        onTeamChange: (teamId) => setActiveManagerTeam(teamId, "manual_select"),
        playerCatalog: gameState.players,
        embeddedGameState: gameState,
        onOpenPlayerDetails: (payload) => openPlayerDrawerById(payload.playerId, payload.activePlayerId),
        onLineupSaved: handleHumanLineupSaved,
        onFormCardPlanSaved: handleFormCardPlanSaved,
        onOpenArena: () => setFoundationView("matchdayArena", setActiveView),
        roomContext,
      }}
    />
  );
}
