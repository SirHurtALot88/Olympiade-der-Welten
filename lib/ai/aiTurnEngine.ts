import type { GameState } from "@/lib/data/olyDataTypes";
import { buildAiTransferIntents } from "@/lib/ai/aiTransferMarket";
import { evaluateAiNeeds } from "@/lib/ai/aiNeedsEngine";
import type { AiTurnResult } from "@/lib/ai/types";

export function runAiTurn(gameState: GameState, teamId: string): AiTurnResult {
  const needs = evaluateAiNeeds(gameState, teamId);
  const transferIntents = buildAiTransferIntents(gameState, teamId);
  const bestIntent = transferIntents[0];

  return {
    teamId,
    summary: bestIntent
      ? `AI-Team ${teamId} priorisiert ${bestIntent.action} fuer Listing ${bestIntent.listingId}.`
      : `AI-Team ${teamId} bleibt in diesem Turn passiv.`,
    needs,
    transferIntents,
  };
}
