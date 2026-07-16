import type { GameState, Player, Team, TransferListing } from "@/lib/data/olyDataTypes";
import type { TransferEvaluation } from "@/lib/market/types";
import { evaluateAiNeeds } from "@/lib/ai/aiNeedsEngine";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function evaluateTransferListing(
  gameState: GameState,
  team: Team,
  listing: TransferListing,
): TransferEvaluation | null {
  const player = gameState.players.find((entry) => entry.id === listing.playerId);
  if (!player) {
    return null;
  }

  const teamNeeds = evaluateAiNeeds(gameState, team.teamId);
  const fitScore = calculateFitScore(player, teamNeeds.topNeedDisciplineIds);
  const needScore = teamNeeds.overallNeedScore;
  const budgetRisk = clamp((listing.askingPrice + listing.minimumSalary * 8) / Math.max(team.cash, 1), 0, 1.6);
  const rosterCount = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
  const rosterPressure = clamp(rosterCount / Math.max(team.rosterLimit, 1), 0, 1.4);
  const overallScore = clamp(fitScore * 0.45 + needScore * 0.4 - budgetRisk * 0.25 - rosterPressure * 0.15, -1, 1);

  return {
    listingId: listing.id,
    playerId: player.id,
    teamId: team.teamId,
    fitScore,
    needScore,
    budgetRisk,
    rosterPressure,
    overallScore,
    recommendedAction: overallScore > 0.35 ? "buy" : overallScore > 0.05 ? "watch" : "skip",
  };
}

function calculateFitScore(player: Player, topNeedDisciplineIds: string[]) {
  if (topNeedDisciplineIds.length === 0) {
    return 0;
  }

  const relevantRatings = topNeedDisciplineIds.map((disciplineId) => player.disciplineRatings[disciplineId] ?? 50);
  const average = relevantRatings.reduce((sum, rating) => sum + rating, 0) / relevantRatings.length;
  return clamp((average - 50) / 50, -1, 1);
}
