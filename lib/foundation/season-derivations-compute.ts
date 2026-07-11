import type { GameState } from "@/lib/data/olyDataTypes";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildPlayerSeasonPerformanceMap } from "@/lib/foundation/player-season-performance";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

import type { SeasonDerivations } from "./season-derivations-cache";

export function computeSeasonDerivationsFresh(gameState: GameState, seasonId: string): SeasonDerivations {
  const ledger = buildSeasonPointsLedger(gameState, seasonId);
  const ratingsById = buildPlayerRatingContractMap(gameState, ledger);
  const performanceByPlayerId = buildPlayerSeasonPerformanceMap(gameState, ledger);

  return {
    ledger,
    ratingsById,
    performanceByPlayerId,
  };
}
