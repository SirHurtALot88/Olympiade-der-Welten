import type { GameState } from "@/lib/data/olyDataTypes";
import { evaluateTransferListing } from "@/lib/market/transfer-market";
import type { AiTransferIntent } from "@/lib/ai/types";

export function buildAiTransferIntents(gameState: GameState, teamId: string): AiTransferIntent[] {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) {
    return [];
  }

  return gameState.transferListings
    .filter((listing) => listing.status === "open")
    .map((listing) => evaluateTransferListing(gameState, team, listing))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => right.overallScore - left.overallScore)
    .slice(0, 3)
    .map((entry) => ({
      teamId,
      listingId: entry.listingId,
      score: entry.overallScore,
      action: entry.recommendedAction,
    }));
}
