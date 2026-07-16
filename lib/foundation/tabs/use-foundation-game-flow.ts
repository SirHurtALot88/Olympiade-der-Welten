import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildGameFlowState } from "@/lib/foundation/game-flow-controller";
import { buildGameInboxItems } from "@/lib/foundation/game-inbox-service";

export function shouldBuildFoundationGameFlow(activeView: string, homeV2Tab?: string): boolean {
  return (
    activeView === "homeV2" ||
    activeView === "inboxV2" ||
    activeView === "inbox" ||
    activeView === "cockpit" ||
    (activeView === "homeV2" && homeV2Tab === "office")
  );
}

export function useFoundationGameFlowState(input: {
  enabled: boolean;
  gameState: GameState;
  activeTeamId: string | null;
}) {
  return useMemo(() => {
    if (!input.enabled) {
      return null;
    }
    return buildGameFlowState({ gameState: input.gameState, activeTeamId: input.activeTeamId });
  }, [input.activeTeamId, input.enabled, input.gameState]);
}

export function useFoundationGameInboxItems(input: {
  enabled: boolean;
  gameState: GameState;
  saveId: string;
  activeTeamId: string | null;
  activeOwnerId: string;
  hostMode: boolean;
  gameFlowState: ReturnType<typeof buildGameFlowState> | null;
}) {
  return useMemo(() => {
    if (!input.enabled || !input.gameFlowState) {
      return [];
    }
    return buildGameInboxItems({
      gameState: input.gameState,
      saveId: input.saveId,
      activeTeamId: input.activeTeamId,
      activeOwnerId: input.activeOwnerId,
      hostMode: input.hostMode,
      gameFlowState: input.gameFlowState,
    });
  }, [
    input.activeOwnerId,
    input.activeTeamId,
    input.enabled,
    input.gameFlowState,
    input.gameState,
    input.hostMode,
    input.saveId,
  ]);
}
