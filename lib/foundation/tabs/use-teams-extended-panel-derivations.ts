import { useMemo } from "react";

import { buildAiTransferIntents } from "@/lib/ai/aiTransferMarket";
import { runAiTurn } from "@/lib/ai/aiTurnEngine";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { TeamControlSettings } from "@/lib/data/olyDataTypes";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";

export type UseTeamsExtendedPanelDerivationsInput = {
  enabled: boolean;
  gameState: GameState;
  selectedTeam: Team | null;
  selectedTeamControl: TeamControlSettings | null | undefined;
  aiTeams: Team[];
  playerRatingsById: Map<string, PlayerRatingContractRow>;
};

export function useTeamsExtendedPanelDerivations(input: UseTeamsExtendedPanelDerivationsInput) {
  const selectedAiTeamId = input.enabled
    ? input.selectedTeamControl?.controlMode === "ai"
      ? input.selectedTeam?.teamId ?? null
      : input.aiTeams[0]?.teamId ?? null
    : null;

  const aiPreview = useMemo(
    () => (selectedAiTeamId && input.enabled ? runAiTurn(input.gameState, selectedAiTeamId) : null),
    [input.enabled, input.gameState, selectedAiTeamId],
  );

  const aiMarketPreview = useMemo(
    () => (selectedAiTeamId && input.enabled ? buildAiTransferIntents(input.gameState, selectedAiTeamId) : []),
    [input.enabled, input.gameState, selectedAiTeamId],
  );

  const freeAgents = useMemo(() => {
    if (!input.enabled) {
      return [];
    }

    const rosteredIds = new Set(input.gameState.rosters.map((entry) => entry.playerId));
    return input.gameState.players
      .filter((player) => !rosteredIds.has(player.id))
      .sort((left, right) => {
        const leftRating = input.playerRatingsById.get(left.id);
        const rightRating = input.playerRatingsById.get(right.id);
        const ovrDelta =
          (rightRating?.ovrNormalized ?? Number.NEGATIVE_INFINITY) -
          (leftRating?.ovrNormalized ?? Number.NEGATIVE_INFINITY);
        if (ovrDelta !== 0) {
          return ovrDelta;
        }

        return left.name.localeCompare(right.name, "de");
      })
      .slice(0, 6);
  }, [input.enabled, input.gameState.players, input.gameState.rosters, input.playerRatingsById]);

  return {
    selectedAiTeamId,
    aiPreview,
    aiMarketPreview,
    freeAgents,
  };
}
