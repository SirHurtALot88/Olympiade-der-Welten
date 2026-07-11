import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSaveContentSignature } from "@/lib/persistence/save-content-signature";

export function buildGameStateContentSignature(gameState: GameState): string {
  const seasonState = gameState.seasonState;
  return buildSaveContentSignature({
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId,
    saveVersion: gameState.saveVersion ?? 0,
    lineupDraftCount: seasonState.lineupDrafts?.length ?? 0,
    transferHistoryCount: gameState.transferHistory?.length ?? 0,
    matchdayResults: seasonState.matchdayResults ?? [],
    standingsApplyLogs: seasonState.standingsApplyLogs ?? [],
    seasonSnapshots: seasonState.seasonSnapshots ?? [],
    disciplineResults: seasonState.disciplineResults ?? [],
  });
}
