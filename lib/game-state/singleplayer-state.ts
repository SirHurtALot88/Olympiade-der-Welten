import {
  createGameStateFromSeed,
  createSaveGameState,
  loadFreshSeasonOneSeedData,
  loadSeedData,
} from "@/lib/data/dataAdapter";
import { withNormalizedTeamIdentityOverrides } from "@/lib/foundation/team-identity-settings";
import { withNormalizedTeamGeneralManagers } from "@/lib/foundation/team-general-managers";
import { withNormalizedTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { withNormalizedTeamStrategyProfiles } from "@/lib/foundation/team-strategy-profiles";
import type { GameLogEntry, GameState, SaveGameState } from "@/lib/data/olyDataTypes";
import { runAiTurn } from "@/lib/ai/aiTurnEngine";

function createLog(message: string, type: GameLogEntry["type"]): GameLogEntry {
  return {
    id: `game-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message,
    type,
    createdAt: new Date().toISOString(),
  };
}

function withNormalizedLocalTeamSettings(gameState: GameState): GameState {
  return withNormalizedTeamStrategyProfiles(
    withNormalizedTeamControlSettings(
      withNormalizedTeamGeneralManagers(withNormalizedTeamIdentityOverrides(gameState)),
    ),
  );
}

export function createSingleplayerSaveGame(): SaveGameState {
  return createSaveGameState("save-singleplayer-dev", loadSeedData());
}

export function createSingleplayerGameState(): GameState {
  return withNormalizedLocalTeamSettings(createGameStateFromSeed(loadSeedData()));
}

export function createFreshSeasonOneGameState(saveId?: string | null): GameState {
  // Threading saveId here seeds the initial season-1 discipline schedule (pairings + 2..6
  // player counts) per save instead of always reusing the "local-game-state" default — see
  // lib/season/season-discipline-schedule.ts for the seed derivation.
  return withNormalizedLocalTeamSettings(
    createGameStateFromSeed(loadFreshSeasonOneSeedData(), saveId ? { scheduleSeedId: saveId } : undefined),
  );
}

export function createFreshSeasonOneSaveGame(saveId: string): SaveGameState {
  return createSaveGameState(saveId, loadFreshSeasonOneSeedData());
}

export function applyAiTurn(gameState: GameState, teamId: string): GameState {
  const result = runAiTurn(gameState, teamId);
  return withNormalizedLocalTeamSettings({
    ...gameState,
    logs: [
      ...gameState.logs,
      createLog(result.summary, "ai"),
      ...result.transferIntents.map((intent) =>
        createLog(
          `AI ${teamId}: ${intent.action} bei ${intent.listingId} mit Score ${intent.score.toFixed(2)}.`,
          "transfer",
        ),
      ),
    ],
  });
}
